import {Player} from "../model/Player";

export interface Cache {
  /**
   * Retrieve room players
   * @param roomId The roomID to retrieve players from
   */
  retrieveRoomPlayers(roomId: string): Promise<Array<Player>>;

  /**
   * Add a player to a room
   * @param roomId The room to add the player in
   * @param player The player's data
   */
  addPlayerToRoom(roomId: string, player: Player): Promise<void>;
  removePlayerFromRoom(roomId: string, playerId: string): Promise<void>;
}
