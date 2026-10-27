export type Room = { revision: number; payload: unknown };
export function createRoomStore(file?: string): {
  get(code: string): Room | null;
  create(payload: unknown): Room & { code: string };
  put(
    code: string,
    revision: number,
    payload: unknown,
  ): Partial<Room> & { status: number };
};
