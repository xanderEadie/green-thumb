#!/bin/bash

# DO NOT PUSH THIS FILE TO GITHUB
# This file contains sensitive information and should be kept private

# TODO: Set your PostgreSQL URI - Use the External Database URL from the Render dashboard
PG_URI="postgresql://users_db_wuz9_user:gfxSDel5rWoS6adQcsCN26HWeUePoreY@dpg-ct8chg3qf0us73en2tq0-a.oregon-postgres.render.com/users_db_wuz9"

# Execute each .sql file in the directory
for file in init_data/*.sql; do
    echo "Executing $file..."
    psql $PG_URI -f "$file"
done