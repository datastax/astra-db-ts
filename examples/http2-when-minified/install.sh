cd ~/work/astra-db-ts || exit
npm run build
npm pack
cd ~/work/astra-db-ts/examples/http2-when-minified || exit
npm i ~/work/astra-db-ts/datastax-astra-db-*.tgz
rm ~/work/astra-db-ts/datastax-astra-db-*.tgz
