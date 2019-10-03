import { Record } from 'relay-runtime/lib/RelayCombinedEnvironmentTypes';
import * as RelayRecordState from 'relay-runtime/lib/RelayRecordState';
import { MutableRecordSource } from 'relay-runtime/lib/RelayStoreTypes';
import { ICache, DataCache } from '@wora/cache-persist';

const { EXISTENT, NONEXISTENT, UNKNOWN } = RelayRecordState;

export interface IMutableRecordSourceOffline extends MutableRecordSource {
    restore(): Promise<DataCache>;
}

export default class RecordSource implements IMutableRecordSourceOffline {
    private _cache: ICache;

    constructor(cache: ICache) {
        this._cache = cache;
    }

    public purge(): Promise<void> {
        this._cache.purge();
        return this._cache.flush();
    }

    public restore(): Promise<DataCache> {
        return this._cache.restore();
    }

    public clear(): void {
        this._cache.purge();
    }

    public delete(dataID: string): void {
        this._cache.delete(dataID);
    }

    public get(dataID: string): Record {
        return this._cache.get(dataID);
    }

    public getRecordIDs(): Array<string> {
        return this._cache.getAllKeys();
    }

    public getStatus(dataID: string): RelayRecordState {
        const state = this._cache.getState();
        if (!state.hasOwnProperty(dataID)) {
            return UNKNOWN;
        }
        return state[dataID] == null ? NONEXISTENT : EXISTENT;
    }

    public has(dataID: string): boolean {
        return this._cache.has(dataID);
    }

    public load(dataID: string, callback: (error: Error, record: Record) => void): void {
        callback(null, this.get(dataID));
    }

    public remove(dataID: string): void {
        this._cache.remove(dataID);
    }

    public set(dataID: string, record: Record): void {
        this._cache.set(dataID, record);
    }

    public size(): number {
        return this._cache.getAllKeys().length;
    }

    public toJSON(): any {
        return this._cache.getState();
    }
}
