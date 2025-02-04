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

import type { TestSchema } from '@/tests/typing/collections/prelude';
import { dummyCollection } from '@/tests/typing/collections/prelude';

void dummyCollection<TestSchema>().insertMany([
  {
    '_id': '2',
    'purchase_type': 'Online',
    '$vector': [0.1, 0.15, 0.3, 0.12, 0.05],
    'customer': {
      'name': 'Jack B.',
      'phone': '123-456-2222',
      'age': 34,
      'credit_score': 700,
      'address': {
        'address_line': '888 Broadway',
        'city': 'New York',
        'state': 'NY',
      },
    },
    'purchase_date': new Date(1690391491),
    'seller': {
      'name': 'Tammy S.',
      'location': 'Staten Island NYC',
    },
    'items': [
      {
        'car': 'Tesla Model 3',
        'color': 'White',
      },
      'Extended warranty - 10 years',
      'Service - 5 years',
    ],
    'amount': 53990,
    'status': 'active',
  },
  {
    '_id': '3',
    'purchase_type': 'Online',
    '$vector': [0.15, 0.1, 0.1, 0.35, 0.55],
    'customer': {
      'name': 'Jill D.',
      'phone': '123-456-3333',
      'age': 30,
      'credit_score': 742,
      'address': {
        'address_line': '12345 Broadway',
        'city': 'New York',
        'state': 'NY',
      },
    },
    'purchase_date': new Date(1690564291),
    'seller': {
      'name': 'Jasmine S.',
      'location': 'Brooklyn NYC',
    },
    'items': 'Extended warranty - 10 years',
    'amount': 4600,
    'status': 'active',
  },
  {
    '_id': '4',
    'purchase_type': 'In Person',
    '$vector': [0.25, 0.25, 0.25, 0.25, 0.26],
    'customer': {
      'name': 'Lester M.',
      'phone': '123-456-4444',
      'age': 40,
      'credit_score': 802,
      'address': {
        'address_line': '12346 Broadway',
        'city': 'New York',
        'state': 'NY',
      },
    },
    'purchase_date': new Date(1690909891),
    'seller': {
      'name': 'Jon B.',
      'location': 'Manhattan NYC',
    },
    'items': [
      {
        'car': 'BMW 330i Sedan',
        'color': 'Red',
      },
      'Extended warranty - 5 years',
      'Service - 5 years',
    ],
    'amount': 48510,
    'status': 'active',
  },
  {
    '_id': '5',
    'purchase_type': 'Online',
    '$vector': [0.25, 0.045, 0.38, 0.31, 0.67],
    'customer': {
      'name': 'David C.',
      'phone': '123-456-5555',
      'age': 50,
      'credit_score': 800,
      'address': {
        'address_line': '32345 Main Ave',
        'city': 'Jersey City',
        'state': 'NJ',
      },
    },
    'purchase_date': new Date(1690996291),
    'seller': {
      'name': 'Jim A.',
      'location': 'Jersey City NJ',
    },
    'items': [
      {
        'car': 'Tesla Model S',
        'color': 'Red',
      },
      'Extended warranty - 5 years',
    ],
    'amount': 94990,
    'status': 'active',
  },
  {
    '_id': '6',
    'purchase_type': 'In Person',
    '$vector': [0.11, 0.02, 0.78, 0.10, 0.27],
    'customer': {
      'name': 'Chris E.',
      'phone': '123-456-6666',
      'age': 43,
      'credit_score': 764,
      'address': {
        'address_line': '32346 Broadway',
        'city': 'New York',
        'state': 'NY',
      },
    },
    'purchase_date': new Date(1691860291),
    'seller': {
      'name': 'Jim A.',
      'location': 'Jersey City NJ',
    },
    'items': [
      {
        'car': 'Tesla Model X',
        'color': 'Blue',
      },
    ],
    'amount': 109990,
    'status': 'active',
  },
  {
    '_id': '7',
    'purchase_type': 'Online',
    '$vector': [0.21, 0.22, 0.33, 0.44, 0.53],
    'customer': {
      'name': 'Jeff G.',
      'phone': '123-456-7777',
      'age': 66,
      'credit_score': 802,
      'address': {
        'address_line': '22999 Broadway',
        'city': 'New York',
        'state': 'NY',
      },
    },
    'purchase_date': new Date(1692119491),
    'seller': {
      'name': 'Jasmine S.',
      'location': 'Brooklyn NYC',
    },
    'items': [{
      'car': 'BMW M440i Gran Coupe',
      'color': 'Black',
    },
      'Extended warranty - 5 years'],
    'amount': 61050,
    'status': 'active',
  },
  {
    '_id': '8',
    'purchase_type': 'In Person',
    '$vector': [0.3, 0.23, 0.15, 0.17, 0.4],
    'customer': {
      'name': 'Harold S.',
      'phone': '123-456-8888',
      'age': 29,
      'credit_score': 710,
      'address': {
        'address_line': '1234 Main St',
        'city': 'Orange',
        'state': 'NJ',
      },
    },
    'purchase_date': new Date(1693329091),
    'seller': {
      'name': 'Tammy S.',
      'location': 'Staten Island NYC',
    },
    'items': [{
      'car': 'BMW X3 SUV',
      'color': 'Black',
    },
      'Extended warranty - 5 years',
    ],
    'amount': 46900,
    'status': 'active',
  },
  {
    '_id': '9',
    'purchase_type': 'Online',
    '$vector': [0.1, 0.15, 0.3, 0.12, 0.06],
    'customer': {
      'name': 'Richard Z.',
      'phone': '123-456-9999',
      'age': 22,
      'credit_score': 690,
      'address': {
        'address_line': '22345 Broadway',
        'city': 'New York',
        'state': 'NY',
      },
    },
    'purchase_date': new Date(1693588291),
    'seller': {
      'name': 'Jasmine S.',
      'location': 'Brooklyn NYC',
    },
    'items': [{
      'car': 'Tesla Model 3',
      'color': 'White',
    },
      'Extended warranty - 5 years',
    ],
    'amount': 53990,
    'status': 'active',
  },
  {
    '_id': '10',
    'purchase_type': 'In Person',
    '$vector': [0.25, 0.045, 0.38, 0.31, 0.68],
    'customer': {
      'name': 'Eric B.',
      'phone': null,
      'age': 54,
      'credit_score': 780,
      'address': {
        'address_line': '9999 River Rd',
        'city': 'Fair Haven',
        'state': 'NJ',
      },
    },
    'purchase_date': new Date(1694797891),
    'seller': {
      'name': 'Jim A.',
      'location': 'Jersey City NJ',
    },
    'items': [{
      'car': 'Tesla Model S',
      'color': 'Black',
    },
    ],
    'amount': 93800,
    'status': 'active',
  },
  {
    '_id': '11',
    'purchase_type': 'Online',
    '$vector': [0.44, 0.11, 0.33, 0.22, 0.88],
    'customer': {
      'name': 'Ann J.',
      'phone': '123-456-1112',
      'age': 47,
      'credit_score': 660,
      'address': {
        'address_line': '99 Elm St',
        'city': 'Fair Lawn',
        'state': 'NJ',
      },
    },
    'purchase_date': new Date(1695921091),
    'seller': {
      'name': 'Jim A.',
      'location': 'Jersey City NJ',
    },
    'items': [{
      'car': 'Tesla Model Y',
      'color': 'White',
    },
      'Extended warranty - 5 years',
    ],
    'amount': 57500,
    'status': 'active',
  },
  {
    '_id': '12',
    'purchase_type': 'In Person',
    '$vector': [0.33, 0.44, 0.55, 0.77, 0.66],
    'customer': {
      'name': 'John T.',
      'phone': '123-456-1123',
      'age': 55,
      'credit_score': 786,
      'address': {
        'address_line': '23 Main Blvd',
        'city': 'Staten Island',
        'state': 'NY',
      },
    },
    'purchase_date': new Date(1696180291),
    'seller': {
      'name': 'Tammy S.',
      'location': 'Staten Island NYC',
    },
    'items': [{
      'car': 'BMW 540i xDrive Sedan',
      'color': 'Black',
    },
      'Extended warranty - 5 years',
    ],
    'amount': 64900,
    'status': 'active',
  },
  {
    '_id': '13',
    'purchase_type': 'Online',
    '$vector': [0.1, 0.15, 0.3, 0.12, 0.07],
    'customer': {
      'name': 'Aaron W.',
      'phone': '123-456-1133',
      'age': 60,
      'credit_score': 702,
      'address': {
        'address_line': '1234 4th Ave',
        'city': 'New York',
        'state': 'NY',
      },
    },
    'purchase_date': new Date(1697389891),
    'seller': {
      'name': 'Jon B.',
      'location': 'Manhattan NYC',
    },
    'items': [{
      'car': 'Tesla Model 3',
      'color': 'White',
    },
      'Extended warranty - 5 years',
    ],
    'amount': 55000,
    'status': 'active',
  },
  {
    '_id': '14',
    'purchase_type': 'In Person',
    '$vector': [0.11, 0.02, 0.78, 0.21, 0.27],
    'customer': {
      'name': 'Kris S.',
      'phone': '123-456-1144',
      'age': 44,
      'credit_score': 702,
      'address': {
        'address_line': '1414 14th Pl',
        'city': 'Brooklyn',
        'state': 'NY',
      },
    },
    'purchase_date': new Date(1698513091),
    'seller': {
      'name': 'Jasmine S.',
      'location': 'Brooklyn NYC',
    },
    'items': [{
      'car': 'Tesla Model X',
      'color': 'White',
    },
    ],
    'amount': 110400,
    'status': 'active',
  },
  {
    '_id': '15',
    'purchase_type': 'Online',
    '$vector': [0.1, 0.15, 0.3, 0.12, 0.08],
    'customer': {
      'name': 'Maddy O.',
      'phone': '123-456-1155',
      'age': 41,
      'credit_score': 782,
      'address': {
        'address_line': '1234 Maple Ave',
        'city': 'West New York',
        'state': 'NJ',
      },
    },
    'purchase_date': new Date(1701191491),
    'seller': {
      'name': 'Jim A.',
      'location': 'Jersey City NJ',
    },
    'items': {
      'car': 'Tesla Model 3',
      'color': 'White',
    },
    'amount': 52990,
    'status': 'active',
  },
  {
    '_id': '16',
    'purchase_type': 'In Person',
    '$vector': [0.44, 0.11, 0.33, 0.22, 0.88],
    'customer': {
      'name': 'Tim C.',
      'phone': '123-456-1166',
      'age': 38,
      'credit_score': 700,
      'address': {
        'address_line': '1234 Main St',
        'city': 'Staten Island',
        'state': 'NY',
      },
    },
    'purchase_date': new Date(1701450691),
    'seller': {
      'name': 'Tammy S.',
      'location': 'Staten Island NYC',
    },
    'items': [{
      'car': 'Tesla Model Y',
      'color': 'White',
    },
      'Extended warranty - 5 years',
    ],
    'amount': 58990,
    'status': 'active',
  },
  {
    '_id': '17',
    'purchase_type': 'Online',
    '$vector': [0.1, 0.15, 0.3, 0.12, 0.09],
    'customer': {
      'name': 'Yolanda Z.',
      'phone': '123-456-1177',
      'age': 61,
      'credit_score': 694,
      'address': {
        'address_line': '1234 Main St',
        'city': 'Hoboken',
        'state': 'NJ',
      },
    },
    'purchase_date': new Date(1702660291),
    'seller': {
      'name': 'Jim A.',
      'location': 'Jersey City NJ',
    },
    'items': [{
      'car': 'Tesla Model 3',
      'color': 'Blue',
    },
      'Extended warranty - 5 years',
    ],
    'amount': 54900,
    'status': 'active',
  },
  {
    '_id': '18',
    'purchase_type': 'Online',
    '$vector': [0.15, 0.17, 0.15, 0.43, 0.55],
    'customer': {
      'name': 'Thomas D.',
      'phone': '123-456-1188',
      'age': 45,
      'credit_score': 724,
      'address': {
        'address_line': '98980 20th St',
        'city': 'New York',
        'state': 'NY',
      },
    },
    'purchase_date': new Date(1703092291),
    'seller': {
      'name': 'Jon B.',
      'location': 'Manhattan NYC',
    },
    'items': [{
      'car': 'BMW 750e xDrive Sedan',
      'color': 'Black',
    },
      'Extended warranty - 5 years',
    ],
    'amount': 106900,
    'status': 'active',
  },
  {
    '_id': '19',
    'purchase_type': 'Online',
    '$vector': [0.25, 0.25, 0.25, 0.25, 0.27],
    'customer': {
      'name': 'Vivian W.',
      'phone': '123-456-1199',
      'age': 20,
      'credit_score': 698,
      'address': {
        'address_line': '5678 Elm St',
        'city': 'Hartford',
        'state': 'CT',
      },
    },
    'purchase_date': new Date(1704215491),
    'seller': {
      'name': 'Jasmine S.',
      'location': 'Brooklyn NYC',
    },
    'items': [{
      'car': 'BMW 330i Sedan',
      'color': 'White',
    },
      'Extended warranty - 5 years',
    ],
    'amount': 46980,
    'status': 'active',
  },
  {
    '_id': '20',
    'purchase_type': 'In Person',
    '$vector': [0.44, 0.11, 0.33, 0.22, 0.88],
    'customer': {
      'name': 'Leslie E.',
      'phone': null,
      'age': 44,
      'credit_score': 782,
      'address': {
        'address_line': '1234 Main St',
        'city': 'Newark',
        'state': 'NJ',
      },
    },
    'purchase_date': new Date(1705338691),
    'seller': {
      'name': 'Jim A.',
      'location': 'Jersey City NJ',
    },
    'items': [{
      'car': 'Tesla Model Y',
      'color': 'Black',
    },
      'Extended warranty - 5 years',
    ],
    'amount': 59800,
    'status': 'active',
  },
  {
    '_id': '21',
    'purchase_type': 'In Person',
    '$vector': [0.21, 0.22, 0.33, 0.44, 0.53],
    'customer': {
      'name': 'Rachel I.',
      'phone': null,
      'age': 62,
      'credit_score': 786,
      'address': {
        'address_line': '1234 Park Ave',
        'city': 'New York',
        'state': 'NY',
      },
    },
    'purchase_date': new Date(1706202691),
    'seller': {
      'name': 'Jon B.',
      'location': 'Manhattan NYC',
    },
    'items': [{
      'car': 'BMW M440i Gran Coupe',
      'color': 'Silver',
    },
      'Extended warranty - 5 years',
      'Gap Insurance - 5 years',
    ],
    'amount': 65250,
    'status': 'active',
  },
], {
  ordered: false,
});
