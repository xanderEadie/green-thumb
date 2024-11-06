CREATE TABLE plants(
    --temporary to fill in for plants for userInfo
    --Ideally the API will have it's own table to take from and connect to users
    plant_id SERIAL PRIMARY KEY NOT NULL,
    image_url VARCHAR(300) NOT NULL,
    name VARCHAR(100),
    moistureNeed INT NOT NULL,
    comfTemp DECIMAL,
    lightLevel INT NOT NULL,
    lifespan INT NOT NULL,
    SIZE DECIMAL,
    rainReq DECIMAL
);
CREATE TABLE userInfo(
    user_id SERIAL PRIMARY KEY NOT NULL,
    name VARCHAR(100),
    username VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL
    yourGarden int[] NOT NULL
);
CREATE TABLE location(
    location_id SERIAL PRIMARY KEY NOT NULL,
    avgHumidity INT NOT NULL,
    rainfall DECIMAL,
    avgTemp DECIMAL,
    daysOfSun INT NOT NULL,
    elevation INT NOT NULL
);
CREATE TABLE user_to_location(
    user_id INT NOT NULL,
    location_id INT NOT NULL,
);