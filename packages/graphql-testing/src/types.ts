import {DocumentNode} from 'graphql';
import {GraphQLRequest, Operation} from 'apollo-link';

export interface FindOptions {
  query?: DocumentNode | {resolver: {resolved?: DocumentNode}};
  mutation?: DocumentNode;
  variables?: Record<string, any>;

  /**
   * @deprecated Please use `query` or `mutation` instead.
   */
  operationName?: string;
}

export type MockGraphQLResponse = Error | object;
export type MockGraphQLFunction = (
  request: GraphQLRequest,
) => MockGraphQLResponse;
export type GraphQLMock =
  | {[key: string]: MockGraphQLResponse | MockGraphQLFunction}
  | MockGraphQLFunction;

export interface MockRequest {
  operation: Operation;
  resolve(): Promise<void>;
}
