/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.createTable('artifacts', (table) => {
        table.increments('id').primary();

        table.string('group').notNullable();
        table.string('artifact').notNullable();
        table.integer('downloads').notNullable().defaultTo(0);

        table.unique(['group', 'artifact']);
    });

    await knex.schema.createTable('artifact_versions', (table) => {
        table.increments('id').primary();

        table.integer('artifact_id').notNullable().unsigned().references('id').inTable('artifacts').withKeyName('artifact_versions_artifact_id');
        table.string('version').notNullable();
        table.integer('downloads').notNullable().defaultTo(0);

        table.unique(['artifact_id', 'version'], {indexName: 'artifact_versions_unique'});
    });

    await knex.schema.createTable('artifact_download_history', (table) => {
        table.integer('artifact_id').notNullable().unsigned().references('id').inTable('artifacts').withKeyName('artifact_download_history_artifact_id');
        table.integer('artifact_version_id').notNullable().unsigned().references('id').inTable('artifact_versions').withKeyName('artifact_download_history_version_id');
        table.datetime('time').notNullable();
        table.integer('downloads').notNullable().defaultTo(0);

        table.unique(['artifact_id', 'artifact_version_id', 'time'], {indexName: 'artifact_download_history_unique'});
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.dropTable('artifact_versions');
    await knex.schema.dropTable('artifacts');
};
