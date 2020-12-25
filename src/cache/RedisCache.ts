import {Cache} from "./Cache";
import {Player} from "../model/Player";
import Redis, {RedisClient} from "redis";

export class RedisCache implements Cache {
  private readonly ROOM_KEY_PRE = process.env.REDIS_ROOM_KEY_PRE || "crewlink:room:";
  private readonly SESSION_KEY_PRE = process.env.REDIS_ROOM_KEY_PRE || "crewlink:session:";
  private readonly redis: RedisClient;

  constructor(redisUrl: string) {
    this.redis = Redis.createClient(redisUrl);
  }

  async addPlayerToRoom(roomId: string, player: Player): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.redis.hset(`${this.ROOM_KEY_PRE}{${roomId}}`,
        player.id, JSON.stringify(player), (err, reply) => {
        if (err) {
          reject(err);
        }
        resolve();
      });
    });
  }

  async removePlayerFromRoom(roomId: string, playerId: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.redis.hdel(`${this.ROOM_KEY_PRE}{${roomId}}`, playerId, (err, reply) => {
        if (err) {
          reject(err);
        }
        resolve();
      });
    });
  }

  async retrieveRoomPlayers(roomId: string): Promise<Array<Player>> {
    return new Promise<Array<Player>>((resolve, reject) => {
      this.redis.hgetall(`${this.ROOM_KEY_PRE}{${roomId}}`, (err, reply) => {
        if (err) {
          reject(err);
        }
        resolve(Object.keys(reply).map(playerId => JSON.parse(reply[playerId])));
      })
    });
  }

  clearSession(socketId: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.redis.del(`${this.SESSION_KEY_PRE}{${socketId}}`, (err, reply) => {
        if (err) {
          reject(err);
        }
        resolve();
      });
    });
  }

  updateSession(socketId: string, serverId: string): Promise<void> {
    // FIXME: In a ideal world, a ping-pong mechanism must exist between client and server and this
    //  should have a TTL and the expire value of this TTL should be updated on each ping, to avoid memory leaks
    //  on redis
    return new Promise<void>((resolve, reject) => {
      this.redis.set(`${this.SESSION_KEY_PRE}{${socketId}}`, serverId,(err, reply) => {
        if (err) {
          reject(err);
        }
        resolve();
      });
    });
  }

  getSession(socketId: string): Promise<string | null> {
    return new Promise<string>((resolve, reject) => {
      this.redis.get(`${this.SESSION_KEY_PRE}{${socketId}}`,(err, reply) => {
        if (err) {
          reject(err);
        }
        resolve(reply);
      });
    });
  }
}
