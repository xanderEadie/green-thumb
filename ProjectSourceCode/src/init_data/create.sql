CREATE TABLE plants(
    plant_id SERIAL PRIMARY KEY NOT NULL,
    common_name VARCHAR(150) NOT NULL,
    scientific_name VARCHAR(150) NOT NULL,
    height DECIMAL NOT NULL,
    cycle VARCHAR(25) NOT NULL,
    hardiness INT NOT NULL,
    watering VARCHAR(25) NOT NULL,
    sunlight VARCHAR(25),
    flowers BOOL, --CHANGE TO BOOL and update INSERT.SQL
    edible BOOL,--CHANGE TO BOOL and update INSERT.SQL
    img VARCHAR(300)
);
CREATE TABLE userInfo(
    user_id SERIAL PRIMARY KEY NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    username VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    password CHAR(60) NOT NULL
);
CREATE TABLE location(
    location_id SERIAL PRIMARY KEY NOT NULL,
    user_id INT REFERENCES userInfo(user_id),
    minHardiness INT,
    maxHardiness INT,
    watering VARCHAR(25),
    sunlight VARCHAR(25)
);
CREATE TABLE user_to_plants(
    user_id INT NOT NULL,
    plant_id INT NOT NULL
);
