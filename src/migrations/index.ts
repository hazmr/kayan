import * as migration_20261111_012309_initial from './20261111_012309_initial';

export const migrations = [
  {
    up: migration_20261111_012309_initial.up,
    down: migration_20261111_012309_initial.down,
    name: '20261111_012309_initial'
  },
];
