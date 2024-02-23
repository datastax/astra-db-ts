import { dummyCollection, TestSchema } from '@/tests/typing/collections/prelude';

void dummyCollection<TestSchema>().insertOne({
  '_id': '1',
  'purchase_type': 'Online',
  '$vector': [0.25, 0.25, 0.25, 0.25, 0.25],
  'customer': {
    'name': 'Jim A.',
    'phone': '123-456-1111',
    'age': 51,
    'credit_score': 782,
    'address': {
      'address_line': '1234 Broadway',
      'city': 'New York',
      'state': 'NY'
    }
  },
  'purchase_date': { '$date': 1690045891 },
  'seller': {
    'name': 'Jon B.',
    'location': 'Manhattan NYC'
  },
  'items': [
    {
      'car': 'BMW 330i Sedan',
      'color': 'Silver'
    },
    'Extended warranty - 5 years'
  ],
  'amount': 47601,
  'status': 'active',
  'preferred_customer': true
});
