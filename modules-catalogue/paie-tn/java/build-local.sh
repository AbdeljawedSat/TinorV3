#!/usr/bin/env bash
# Construction hors Maven (environnement sans accès à Maven Central). NetBeans/Maven : utiliser pom.xml.
set -euo pipefail
cd "$(dirname "$0")"
LIB=${LIB:-/usr/share/java}
OUT=build
rm -rf $OUT && mkdir -p $OUT/engine/tn/jas/paie $OUT/engine-test $OUT/app
# moteur
javac --release 17 -encoding UTF-8 -d $OUT/engine $(find paie-engine/src/main/java -name '*.java')
cp ../shared/parametres-tn.json ../shared/rubriques-tn.json $OUT/engine/tn/jas/paie/
jar cf $OUT/paie-engine.jar -C $OUT/engine .
# tests moteur
javac --release 17 -encoding UTF-8 -cp $OUT/paie-engine.jar:$LIB/junit-jupiter-api.jar:$LIB/apiguardian-api.jar:$LIB/opentest4j.jar \
  -d $OUT/engine-test $(find paie-engine/src/test/java -name '*.java')
java -jar $LIB/junit-platform-console-standalone.jar -cp $OUT/paie-engine.jar:$OUT/engine-test --scan-classpath --disable-banner --details=summary
# application
if [ -d paie-app/src/main/java ]; then
  CP=$OUT/paie-engine.jar:$LIB/pdfbox2.jar:$LIB/fontbox2.jar:$LIB/commons-logging.jar
  javac --release 17 -encoding UTF-8 -cp $CP -d $OUT/app $(find paie-app/src/main/java -name '*.java')
  cp -r paie-app/src/main/resources/* $OUT/app/ 2>/dev/null || true
  mkdir -p $OUT/app/db && cp ../shared/sql/*.sql $OUT/app/db/
  jar cfe $OUT/paie-app.jar tn.jas.paie.app.App -C $OUT/app .
  echo "OK : $OUT/paie-app.jar"
fi
# tests d'intégration (base MariaDB requise) : IT_USER=... IT_PASSWORD=... ./build-local.sh
if [ -n "${IT_USER:-}" ]; then
  mkdir -p $OUT/app-test
  CPT=$OUT/paie-app.jar:$OUT/paie-engine.jar:$LIB/pdfbox2.jar:$LIB/fontbox2.jar:$LIB/commons-logging.jar:$LIB/mariadb-java-client.jar
  javac --release 17 -encoding UTF-8 -cp $CPT:$LIB/junit-jupiter-api.jar:$LIB/apiguardian-api.jar:$LIB/opentest4j.jar -d $OUT/app-test $(find paie-app/src/test/java -name '*.java')
  java -Dit.url=${IT_URL:-jdbc:mariadb://localhost:3306/} -Dit.user=$IT_USER -Dit.password=${IT_PASSWORD:-} \
    -jar $LIB/junit-platform-console-standalone.jar execute -cp $CPT:$OUT/app-test --select-class tn.jas.paie.app.WorkflowIT --disable-banner --details=tree
fi
