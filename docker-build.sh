#download nebula bin if not present
if [ ! -f "nebula/nebula" ]
then
    ./downloadNebula.sh
fi

docker-compose -f docker-compose-build.yml build