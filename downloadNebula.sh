CURFOLDER=${PWD}
mkdir -p $CURFOLDER/nebula/

cd /tmp
wget https://github.com/slackhq/nebula/releases/download/v1.5.2/nebula-linux-amd64.tar.gz -O /tmp/nebula-linux-amd64.tar.gz
tar -xf nebula-linux-amd64.tar.gz

mv nebula $CURFOLDER/nebula/nebula
mv nebula-cert $CURFOLDER/nebula/nebula-cert