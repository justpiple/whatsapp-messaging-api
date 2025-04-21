import type {
  AuthenticationCreds,
  AuthenticationState,
  SignalDataTypeMap,
} from "baileys";
import { proto, BufferJSON, initAuthCreds } from "baileys";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { prisma } from "../app";
import logger from "./logger";

const fixId = (id: string) => id.replace(/\//g, "__").replace(/:/g, "-");

export async function usePostgresAuthState(accountId: number): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> {
  const model = prisma.session;

  const write = async (data: any, id: string) => {
    try {
      data = JSON.stringify(data, BufferJSON.replacer);
      id = fixId(id);
      await model.upsert({
        select: { id: true },
        create: { data, identifier: id, whatsappAccountId: accountId },
        update: { data },
        where: {
          whatsappAccountId_identifier: {
            whatsappAccountId: accountId,
            identifier: id,
          },
        },
      });
    } catch (e) {
      logger.error(
        (e as Error).message,
        "An error occured during session write",
      );
    }
  };

  const read = async (id: string) => {
    try {
      const result = await model.findUnique({
        select: { data: true },
        where: {
          whatsappAccountId_identifier: {
            identifier: fixId(id),
            whatsappAccountId: accountId,
          },
        },
      });

      if (!result) {
        return null;
      }

      return JSON.parse(result.data, BufferJSON.reviver);
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === "P2025") {
        logger.info("Trying to read non existent session data");
      } else {
        logger.error(
          (e as Error).message,
          "An error occured during session read",
        );
      }
      return null;
    }
  };

  const del = async (id: string) => {
    try {
      await model.delete({
        select: { id: true },
        where: {
          whatsappAccountId_identifier: {
            identifier: fixId(id),
            whatsappAccountId: accountId,
          },
        },
      });
    } catch (e) {
      logger.error(
        (e as Error).message,
        "An error occured during session delete",
      );
    }
  };

  const creds: AuthenticationCreds = (await read("creds")) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async <T extends keyof SignalDataTypeMap>(
          type: T,
          ids: string[],
        ): Promise<{
          [id: string]: SignalDataTypeMap[T];
        }> => {
          const data: { [key: string]: SignalDataTypeMap[typeof type] } = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await read(`${type}-${id}`);
              if (type === "app-state-sync-key" && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            }),
          );
          return data;
        },
        set: async (data: any): Promise<void> => {
          const tasks: Promise<void>[] = [];

          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const sId = `${category}-${id}`;
              tasks.push(value ? write(value, sId) : del(sId));
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: () => write(creds, "creds"),
  };
}
