import {Player} from "../model/Player";

export class PlayerSessionsManager {
  private players: Map<string, Player> = new Map();

  getPlayer(socketId: string): Player {
    return this.players.get(socketId);
  }

  updatePlayer(socketId: string, player: Player): void {
    this.players.set(player.id, player);
  }

  clearPlayer(socketId: string): void {
    this.players.delete(socketId);
  }
}
