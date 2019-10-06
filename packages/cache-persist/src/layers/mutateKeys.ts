import { IMutateKey } from '../CacheTypes';

function mutateKeys(set: (key: string) => string | null, get: (key: string) => string | null): IMutateKey {
    return { set, get } as IMutateKey;
}

export default mutateKeys;
