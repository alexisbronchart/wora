/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 * @flow strict-local
 * @emails oncall+relay
 */

// flowlint ambiguous-object-type:error

'use strict';

jest.mock('fbjs/lib/warning');
import { Store as RelayModernStore, RecordSource, Environment as RelayModernEnvironment } from '../src';
import { Network as RelayNetwork, createOperationDescriptor, createReaderSelector } from 'relay-runtime';
import { createPersistedStorage } from './Utils';
const { generateAndCompile } = require('relay-test-utils-internal');
const RelayRecordSource = {
    create: (data?: any) => new RecordSource({ storage: createPersistedStorage(), initialState: { ...data } }),
};
//const
const warning = require('fbjs/lib/warning');

jest.useFakeTimers();

describe('commitPayload()', () => {
    let ActorQuery;
    let environment;
    let operation;
    let source;
    let store;

    beforeEach(async () => {
        jest.resetModules();
        ({ ActorQuery } = generateAndCompile(`
        query ActorQuery {
          me {
            name
          }
        }
      `));
        operation = createOperationDescriptor(ActorQuery, {});
        source = RelayRecordSource.create();
        store = new RelayModernStore(source);
        environment = new RelayModernEnvironment({
            network: RelayNetwork.create(jest.fn()),
            store,
        });
        store.notify = jest.fn(store.notify.bind(store));
        store.publish = jest.fn(store.publish.bind(store));
        await environment.hydrate();
    });

    it('applies server updates', () => {
        const callback = jest.fn();
        const snapshot = environment.lookup(operation.fragment);
        environment.subscribe(snapshot, callback);

        environment.commitPayload(operation, {
            me: {
                id: '4',
                __typename: 'User',
                name: 'Zuck',
            },
        });
        expect(callback.mock.calls.length).toBe(1);
        expect(callback.mock.calls[0][0].data).toEqual({
            me: {
                name: 'Zuck',
            },
        });
    });

    it('rebases optimistic updates', () => {
        const callback = jest.fn();
        const snapshot = environment.lookup(operation.fragment);
        environment.subscribe(snapshot, callback);

        environment.applyUpdate({
            storeUpdater: (proxyStore) => {
                const zuck = proxyStore.get('4');
                if (zuck) {
                    const name = zuck.getValue('name');
                    if (typeof name !== 'string') {
                        throw new Error('Expected zuck.name to be defined');
                    }
                    zuck.setValue(name.toUpperCase(), 'name');
                }
            },
        });

        environment.commitPayload(operation, {
            me: {
                id: '4',
                __typename: 'User',
                name: 'Zuck',
            },
        });
        expect(callback.mock.calls.length).toBe(1);
        expect(callback.mock.calls[0][0].data).toEqual({
            me: {
                name: 'ZUCK',
            },
        });
    });

    it('applies payload on @defer fragments', () => {
        const id = '4';
        const query = generateAndCompile(`
        query ActorQuery {
          me {
            name
            ...UserFragment @defer
          }
        }

        fragment UserFragment on User {
          username
        }
      `);
        operation = createOperationDescriptor(query.ActorQuery, {});

        const selector = createReaderSelector(query.UserFragment, id, {}, operation.request);

        const queryCallback = jest.fn();
        const fragmentCallback = jest.fn();
        const querySnapshot = environment.lookup(operation.fragment);
        const fragmentSnapshot = environment.lookup(selector);
        environment.subscribe(querySnapshot, queryCallback);
        environment.subscribe(fragmentSnapshot, fragmentCallback);
        expect(queryCallback.mock.calls.length).toBe(0);
        expect(fragmentCallback.mock.calls.length).toBe(0);
        environment.commitPayload(operation, {
            me: {
                id,
                __typename: 'User',
                name: 'Zuck',
                username: 'Zucc',
            },
        });
        expect(queryCallback.mock.calls.length).toBe(1);
        expect(queryCallback.mock.calls[0][0].data).toEqual({
            me: {
                name: 'Zuck',
                __id: id,
                __fragments: { UserFragment: {} },
                __fragmentOwner: operation.request,
            },
        });
        expect(fragmentCallback.mock.calls.length).toBe(2);
        expect(fragmentCallback.mock.calls[1][0].data).toEqual({
            username: 'Zucc',
        });
        expect(warning).toBeCalledWith(
            true,
            expect.stringContaining('RelayModernEnvironment: Operation `%s` contains @defer/@stream directives'),
            'ActorQuery',
        );
    });

    it('applies payload on @defer fragments in a query with modules', () => {
        const id = '4';
        const query = generateAndCompile(`
        query ActorQuery {
          me {
            name
            nameRenderer {
              ...MarkdownUserNameRenderer_name
                @module(name: "MarkdownUserNameRenderer.react")
            }
            ...UserFragment @defer
          }
        }

        fragment MarkdownUserNameRenderer_name on MarkdownUserNameRenderer {
          __typename
          markdown
        }

        fragment UserFragment on User {
          username
        }
      `);

        environment = new RelayModernEnvironment({
            network: RelayNetwork.create(jest.fn()),
            store,
            operationLoader: {
                get: () => {
                    return query.MarkdownUserNameRenderer_name;
                },
                load: jest.fn(),
            },
        });

        operation = createOperationDescriptor(query.ActorQuery, {});

        const selector = createReaderSelector(query.UserFragment, id, {}, operation.request);

        const queryCallback = jest.fn();
        const fragmentCallback = jest.fn();
        const querySnapshot = environment.lookup(operation.fragment);
        const fragmentSnapshot = environment.lookup(selector);
        environment.subscribe(querySnapshot, queryCallback);
        environment.subscribe(fragmentSnapshot, fragmentCallback);
        expect(queryCallback.mock.calls.length).toBe(0);
        expect(fragmentCallback.mock.calls.length).toBe(0);
        environment.commitPayload(operation, {
            me: {
                id,
                __typename: 'User',
                nameRenderer: {
                    __typename: 'MarkdownUserNameRenderer',
                    __module_component_ActorQuery: 'MarkdownUserNameRenderer.react',
                    __module_operation_ActorQuery: 'MarkdownUserNameRenderer_name$normalization.graphql',
                    markdown: 'markdown payload',
                },
                name: 'Zuck',
                username: 'Zucc',
            },
        });
        expect(queryCallback.mock.calls.length).toBe(1);
        expect(fragmentCallback.mock.calls.length).toBe(2);
        expect(fragmentCallback.mock.calls[0][0].data).toEqual({
            username: undefined,
        });
        expect(fragmentCallback.mock.calls[1][0].data).toEqual({
            username: 'Zucc',
        });
        expect(warning).toBeCalledWith(
            true,
            expect.stringContaining('RelayModernEnvironment: Operation `%s` contains @defer/@stream directives'),
            'ActorQuery',
        );
    });
});
