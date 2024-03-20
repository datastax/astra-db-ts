import { uuidv4, uuidv7, UUID as UUIDv7 } from 'uuidv7';
import { ObjectId as MongoObjectId } from 'bson';

const uuidRegex = new RegExp('^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$');

export class UUID {
  public readonly version: number;

  constructor(private readonly _uuid: string) {
    if (this._uuid.length !== 36 || !uuidRegex.test(this._uuid)) {
      throw new Error('UUID must be a 36-character hex string');
    }

    this.version = parseInt(this._uuid[14], 16);
  }

  public getTimestamp(): Date | undefined {
    return timestampFromUUID(this);
  }

  public toString(): string {
    return this._uuid;
  }

  public static v4(): UUID {
    return new UUID(uuidv4());
  }

  public static v7(): UUID {
    return new UUID(uuidv7());
  }

  public inspect(): string {
    return `UUID("${this.toString()}")`;
  }
}

const objectIdRegex = new RegExp('^[0-9a-fA-F]{24}$');

export class ObjectId {
  private readonly _objectId: MongoObjectId;

  constructor(id?: string | MongoObjectId) {
    if (typeof id === 'string') {
      if (id.length !== 24 || !objectIdRegex.test(id)) {
        throw new Error('ObjectId must be a 24-character hex string');
      }
    }

    this._objectId = new MongoObjectId(id);
  }

  public getTimestamp(): Date {
    return this._objectId.getTimestamp();
  }

  public toString(): string {
    return this._objectId.toString();
  }

  public inspect(): string {
    return `ObjectId("${this.toString()}")`;
  }
}

export function replaceRawId(obj: any): any {
  if (obj.$uuid) {
    return new UUID(obj._id.$uuid);
  }

  if (obj.$objectId) {
    return new ObjectId(obj._id.$objectId);
  }

  if (obj._id && typeof obj._id === 'object') {
    if (obj._id.$uuid) {
      obj._id = new UUID(obj._id.$uuid);
    } else if (obj._id.$objectId) {
      obj._id = new ObjectId(obj._id.$objectId);
    }
  }

  return obj;
}

const timestampFromUUID = (uuid: UUID): Date | undefined => {
  if (uuid.version !== 7) {
    return undefined;
  }

  const timestampBytes = new Uint8Array(8);
  timestampBytes.set(new Uint8Array(UUIDv7.parse(uuid.toString()).bytes.buffer.slice(0, 6)), 2);
  const timestampMs = new DataView(timestampBytes.buffer).getBigUint64(0);

  return new Date(Number(timestampMs));
}
