import { SomeDoc } from '@/src/client';
import { ToDotNotation } from '@/src/client/types/dot-notation';

/**
 * Specifies the sort criteria for selecting documents.
 *
 * Can use `1`/`-1` for ascending/descending, or `$vector`/`$vectorize` for sorting by vector distance.
 *
 * **NB. The order of the fields in the sort option is significant—fields are sorted in the order they are listed.**
 *
 * @example
 * ```typescript
 * // Sort by name in ascending order, then by age in descending order
 * const sort1: SortOption<SomeDoc> = {
 *   name: 1,
 *   age: -1,
 * }
 *
 * // Sort by vector distance
 * const sort2: SortOption<SomeDoc> = {
 *   $vector: [0.23, 0.38, 0.27, 0.91, 0.21],
 * }
 * ```
 */
export type SortOption<Schema extends SomeDoc> =
  | { [K in keyof ToDotNotation<Schema>]?: 1 | -1 }
  | { $vector: { $meta: number[] } }
  | { $vector: number[] }
  | { $vectorize: string };

/**
 * Specifies which fields should be included/excluded in the returned documents.
 *
 * Can use `1`/`0`, or `true`/`false`
 *
 * @example
 * ```typescript
 * // Include _id, name, and address.state
 * const projection1: ProjectionOption<SomeDoc> = {
 *   _id: 1,
 *   name: 1,
 *   'address.state': 1,
 * }
 *
 * // Exclude the $vector
 * const projection2: ProjectionOption<SomeDoc> = {
 *   $vector: 0,
 * }
 *
 * // Return array indices 2, 3, 4, and 5
 * const projection3: ProjectionOption<SomeDoc> = {
 *   test_scores: { $slice: [2, 4] },
 * }
 * ```
 */
export type ProjectionOption<Schema extends SomeDoc> = {
  [K in keyof ToDotNotation<Schema> | '_id']?: any[] extends (ToDotNotation<Schema> & { _id: string })[K]
    ? 1 | 0 | true | false | Slice
    : 1 | 0 | true | false;
};

/**
 * Specifies the number of elements in an array to return in the query result.
 *
 * Has one of the following forms:
 * ```
 * // Return the first two elements
 * { $slice: 2 }
 *
 * // Return the last two elements
 * { $slice: -2 }
 *
 * // Skip 4 elements (from 0th index), return the next 2
 * { $slice: [4, 2] }
 *
 * // Skip backward 4 elements, return next 2 elements (forward)
 * { $slice: [-4, 2] }
 * ```
 */
interface Slice {
  $slice: number | [number, number];
}
