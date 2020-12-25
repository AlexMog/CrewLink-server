import {Cache} from "./Cache";
import {Player} from "../model/Player";

export class LocalCache implements Cache {
  private rooms: Map<string, Array<Player>> = new Map();

  async addPlayerToRoom(roomId: string, player: Player): Promise<void> {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = [];
      this.rooms.set(roomId, room);
    }
    room.push(player);
  }

  async clearSession(socketId: string): Promise<void> {
    return Promise.resolve(undefined);
  }

  async getSession(socketId: string): Promise<string> {
    return Promise.resolve("");
  }

  async removePlayerFromRoom(roomId: string, playerId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (room) {
      let i = room.length;
      while (--i) {
        if (room[i].id == playerId) {
          room.splice(i, 1);
        }
      }
      if (room.length == 0) {
        this.rooms.delete(roomId);
      }
    }
  }

  async retrieveRoomPlayers(roomId: string): Promise<Array<Player>> {
    return this.rooms.get(roomId) || [];
  }

  async updateSession(socketId: string, serverId: string): Promise<void> {
    return Promise.resolve(undefined);
  }

}
