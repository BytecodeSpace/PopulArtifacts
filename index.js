const express = require('express');
const NginxParser = require('nginxparser');
const readline = require('readline');
const TailFile = require('@logdna/tail-file');

const app = express();
const knex = require('knex')(require('./knexfile.js'));
const tail = new TailFile(process.env.LOG_FILE || './NEXUS_NGINX_LOG', {encoding: 'utf8'})
const parser = new NginxParser('$remote_addr - $remote_user [$time_local] "$method $path HTTP/$http_version" $status $body_bytes_sent "$http_referer" "$http_user_agent"');

(async () => {
    tail.on('tail_error', e => console.error(e));

    await tail.start()
    const linesplitter = readline.createInterface({
        input: tail
    });

    linesplitter.on('line', (line) => {
        console.log(line);
        handleLine(line);
    });
})();

handleLine = line => parser.parseLine(line, async parsed => {
    const {method, path, status} = parsed;

    // This .toString is not redundant, it converts path into a string in case it's undefined
    if (method !== 'GET' || status !== '200' || !path.toString().startsWith('/repository/')) return;

    // /repository/{repository}/{group}/{artifact}/{version}/{file}
    const urlComponents = path.split('/').slice(2);
    if (urlComponents.length < 5) return;

    const repository = urlComponents.shift();
    const file = urlComponents.pop();
    const version = urlComponents.pop();
    const artifact = urlComponents.pop();
    const group = urlComponents.join('.');

    // Only care about actual downloads.
    if (file.endsWith('.pom') || file.endsWith('.md5') || file.endsWith('.sha1')) return;

    let time = new Date();
    time.setMinutes(0, 0, 0); // Group by hour

    const [artifactId] = await knex('artifacts')
        .insert({
            group,
            artifact,
            downloads: 1
        })
        .onConflict(['group', 'artifact'])
        .merge({
            downloads: knex.raw('?? + ?', ['downloads', 1])
        });

    const [artifactVersionId] = await knex('artifact_versions')
        .insert({
            artifact_id: artifactId,
            version,
            downloads: 1
        })
        .onConflict(['group', 'artifact_id', 'version'])
        .merge({
            downloads: knex.raw('?? + ?', ['downloads', 1])
        });

    await knex('artifact_download_history')
        .insert({
            artifact_id: artifactId,
            artifact_version_id: artifactVersionId,
            time,
            downloads: 1
        })
        .onConflict(['group', 'artifact_id', 'artifaction_version_id', 'time'])
        .merge({
            downloads: knex.raw('?? + ?', ['downloads', 1])
        });
});

tail.on('error', error => console.error(error));

const port = process.env.HTTP_PORT || 3000;
app.listen(port, () => {
    console.log(`Listening on port ${port}!`);
});
