// Copyright DataStax, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import assert from 'assert';
import { extractDbIdFromUrl, replaceAstraUrlIdAndRegion } from '@/src/data-api/utils';
import { describe, it } from '@/tests/test-utils';

describe('unit.data-api.utils', () => {
  describe('extractDbIdFromUri tests', () => {
    it('should extract the db id from the uri', () => {
      const endpoint1 = 'https://a5cf1913-b80b-4f44-ab9f-a8b1c98469d0-ap-south-1.apps.astra.datastax.com';
      const id1 = extractDbIdFromUrl(endpoint1);
      assert.strictEqual(id1, 'a5cf1913-b80b-4f44-ab9f-a8b1c98469d0', 'Could not parse id from prod url');

      const endpoint2 = 'https://a5cf1913-b80b-4f44-ab9f-a8b1c98469d0-ap-south-1.apps.astra-dev.datastax.com';
      const id2 = extractDbIdFromUrl(endpoint2);
      assert.strictEqual(id2, 'a5cf1913-b80b-4f44-ab9f-a8b1c98469d0', 'Could not parse id from dev url');
    });

    it('returned undefined on invalid url', () => {
      const endpoint1 = 'https://localhost:3000';
      const id1 = extractDbIdFromUrl(endpoint1);
      assert.strictEqual(id1, undefined, 'Parsed invalid localhost URL');

      const endpoint2 = 'https://z5cf1913-b80b-4f44-ab9f-a8b1c98469d0-ap-south-1.apps.astra.datastax.com';
      const id2 = extractDbIdFromUrl(endpoint2);
      assert.strictEqual(id2, undefined, 'Parsed invalid id from prod url');
    });
  });

  describe('replaceAstraUrlIdAndRegion tests', () => {
    it('should replace the db id and region in the uri', () => {
      const endpoint1 = 'https://a5cf1913-b80b-4f44-ab9f-a8b1c98469d0-ap-south-1.apps.astra.datastax.com';
      const newEndpoint1 = replaceAstraUrlIdAndRegion(endpoint1, 'new-id', 'new-region');
      assert.strictEqual(newEndpoint1, 'https://new-id-new-region.apps.astra.datastax.com', 'Could not replace id and region in prod url');

      const endpoint2 = 'https://a5cf1913-b80b-4f44-ab9f-a8b1c98469d0-ap-south-1.apps.astra-dev.datastax.com';
      const newEndpoint2 = replaceAstraUrlIdAndRegion(endpoint2, 'new-id', 'new-region');
      assert.strictEqual(newEndpoint2, 'https://new-id-new-region.apps.astra-dev.datastax.com', 'Could not replace id and region in dev url');
    });
  });
});
