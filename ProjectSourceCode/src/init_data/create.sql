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
    plantSize DECIMAL,
    rainReq DECIMAL
);
--lightlevel is rated out of 3, 1 being low, 3 being high, same scale applies to locations
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
    avgHumidity INT NOT NULL,
    rainfall DECIMAL,
    avgTemp DECIMAL,
    lightAmount INT NOT NULL,
    elevation INT NOT NULL
);
CREATE TABLE user_to_location(
    user_id INT NOT NULL,
    location_id INT NOT NULL,
    PRIMARY KEY (user_id, location_id),
    FOREIGN KEY (user_id) REFERENCES userInfo(user_id),
    FOREIGN KEY (location_id) REFERENCES location(location_id)
);
CREATE TABLE user_to_plants(
    user_id INT NOT NULL,
    plant_id INT NOT NULL
);
