import { Equal, Expect } from '@/tests/typing/prelude';
import { AstraDBOptions } from '@/src/client/astra';
import { HTTPClientOptions } from '@/src/api';

type _test1 = Expect<Equal<AstraDBOptions, Omit<HTTPClientOptions, 'applicationToken'>>>