import * as migration_20261111_012309_initial from './20261111_012309_initial';
import * as migration_20261111_014254_courses from './20261111_014254_courses';
import * as migration_20261111_091745_optional_english from './20261111_091745_optional_english';
import * as migration_20261111_093723_owner_promotions from './20261111_093723_owner_promotions';
import * as migration_20261111_221800_orders from './20261111_221800_orders';
import * as migration_20261111_221900_open_order_index from './20261111_221900_open_order_index';
import * as migration_20261111_225744_payouts from './20261111_225744_payouts';
import * as migration_20261112_021533_master_owner from './20261112_021533_master_owner';
import * as migration_20261112_024249_lesson_progress from './20261112_024249_lesson_progress';

export const migrations = [
  {
    up: migration_20261111_012309_initial.up,
    down: migration_20261111_012309_initial.down,
    name: '20261111_012309_initial',
  },
  {
    up: migration_20261111_014254_courses.up,
    down: migration_20261111_014254_courses.down,
    name: '20261111_014254_courses',
  },
  {
    up: migration_20261111_091745_optional_english.up,
    down: migration_20261111_091745_optional_english.down,
    name: '20261111_091745_optional_english',
  },
  {
    up: migration_20261111_093723_owner_promotions.up,
    down: migration_20261111_093723_owner_promotions.down,
    name: '20261111_093723_owner_promotions',
  },
  {
    up: migration_20261111_221800_orders.up,
    down: migration_20261111_221800_orders.down,
    name: '20261111_221800_orders',
  },
  {
    up: migration_20261111_221900_open_order_index.up,
    down: migration_20261111_221900_open_order_index.down,
    name: '20261111_221900_open_order_index',
  },
  {
    up: migration_20261111_225744_payouts.up,
    down: migration_20261111_225744_payouts.down,
    name: '20261111_225744_payouts',
  },
  {
    up: migration_20261112_021533_master_owner.up,
    down: migration_20261112_021533_master_owner.down,
    name: '20261112_021533_master_owner',
  },
  {
    up: migration_20261112_024249_lesson_progress.up,
    down: migration_20261112_024249_lesson_progress.down,
    name: '20261112_024249_lesson_progress'
  },
];
