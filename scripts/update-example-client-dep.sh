cwd=$(pwd)

case $1 in
npm)
  for dir in examples/*; do
    cd "$cwd/$dir" || exit 1
    npm rm @datastax/astra-db-ts
    npm i @datastax/astra-db-ts
  done
  ;;
local)
  tarball_dir=$(pwd)

  npm run build
  npm pack

  for dir in examples/*; do
    cd "$cwd/$dir" || exit 1
    npm i "${tarball_dir}"/datastax-astra-db-ts-*.tgz
    npm i @datastax/astra-db-ts
  done

  rm "${tarball_dir}"/datastax-astra-db-ts-*.tgz
  ;;
*)
  echo 'Invalid args-must pass either "npm" or "local"'
  ;;
esac
