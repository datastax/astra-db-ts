// import { parallel, describe, it, background } from '@/tests/testlib';
//
// parallel('testing.test.1', () => {
//   it('1', async () => {
//     await new Promise((resolve) => setTimeout(resolve, 1000));
//     console.log('hi from #1!');
//   });
//
//   describe('2', () => {
//     it('2.1', async () => {
//       await new Promise((resolve) => setTimeout(resolve, 1000));
//       console.log('hi from #2.1!');
//     });
//
//     it('2.1', async () => {
//       await new Promise((resolve) => setTimeout(resolve, 1000));
//       console.log('hi from #2.1!');
//     });
//   });
//
//   it('3', async () => {
//     await new Promise((resolve) => setTimeout(resolve, 1000));
//     console.log('hi from #3!');
//   });
// });
//
// background('testing.test.2', () => {
//   it('4', async () => {
//     await new Promise((resolve) => setTimeout(resolve, 1000));
//     console.log('hi from #4!');
//   });
// });
