// *****************************************************
// <!-- Section 1 : Import Dependencies -->
// *****************************************************

const express = require('express'); // To build an application server or API
const app = express();
const handlebars = require('express-handlebars');
const Handlebars = require('handlebars');
const path = require('path');
const pgp = require('pg-promise')(); // To connect to the Postgres DB from the node server
const bodyParser = require('body-parser');
const session = require('express-session'); // To set the session object. To store or access session data, use the `req.session`, which is (generally) serialized as JSON by the store.
const bcrypt = require('bcryptjs'); //  To hash passwords
const axios = require('axios'); // To make HTTP requests from our server. We'll learn more about it in Part C.
const { error } = require('console');

// *****************************************************
// <!-- Section 2 : Connect to DB -->
// *****************************************************

// create `ExpressHandlebars` instance and configure the layouts and partials dir.
const hbs = handlebars.create({
  extname: 'hbs',
  layoutsDir: __dirname + '/views/layouts',
  partialsDir: __dirname + '/views/partials',
});

// database configuration
const dbConfig = {
  host: 'db', // the database server
  port: 5432, // the database port
  database: process.env.POSTGRES_DB, // the database name
  user: process.env.POSTGRES_USER, // the user account to connect with
  password: process.env.POSTGRES_PASSWORD, // the password of the user account
};

const db = pgp(dbConfig);

// test your database
db.connect()
  .then(obj => {
    console.log('Database connection successful'); // you can view this message in the docker compose logs
    obj.done(); // success, release the connection;
  })
  .catch(error => {
    console.log('ERROR:', error.message || error);
  });

// *****************************************************
// <!-- Section 3 : App Settings -->
// *****************************************************

// Register `hbs` as our view engine using its bound `engine()` function.
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(__dirname + '/resources')); 
app.use(bodyParser.json()); // specify the usage of JSON for parsing request body.

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

// initialize session variables
app.use(
    session({
      secret: process.env.SESSION_SECRET,
      saveUninitialized: false,
      resave: false,
    })
);

app.use((req, res, next) => {
  res.locals.staticData = {
      user:req.session.user,
  };
  next();
});

// *****************************************************
// <!-- Section 4 : API Routes -->
// *****************************************************

app.get('/welcome', (req, res) => {
  res.json({status: 'success', message: 'Welcome!'});
});

// when navigating to website, redirect to home
app.get('/',(req,res) => {
    res.status(200).redirect('/home');
})

// GET home
app.get('/home',(req,res) => {
  res.status(200).render('pages/home');
})

// redirect to login
app.get('/login',(req,res) => {
  res.status(200).render('pages/login');
})

app.post('/login', async (req, res) => 
{
  console.log("attempting to log in user");
  try
  {
    console.log("finding user in users table");
      // find user from users table for req username
      let find_usr_q = "SELECT * FROM userInfo WHERE username=$1 LIMIT 1;";
      let values = [req.body.username];
      const found_user = await db.one(find_usr_q,values);

      try
      {
        // user exists, attempt to validate password
        console.log("user exists, validating password");
        const pwd_match = await bcrypt.compare(req.body.password, found_user.password);
        if(pwd_match == true)
        {
            //save user details in session
            req.session.user = found_user;
            req.session.username = req.body.username;
            req.session.user_id = req.body.user_id;
            
            req.session.save((err) => {
                if (err) {
                    console.log('session save error:', err);
                    res.status(500);
                }
                else
                {
                    res.status(200).redirect('/home');
                    console.log("successful login, set session user to",req.session.username);                      
                }
            })
        }
        else 
        {
          throw new Error('password is incorrect')
        }
      }
      catch (err)
      {
        console.log("incorrect password");
        res.status(409).render('pages/login',{message:"Password is incorrect. Please try again."});
      }
      
  }
  catch(err)
  {
      console.log(err);
      res.status(404).render('pages/login',{message:"User does not exist. Please try again."});
  }
});

// GET register
app.get('/register',(req,res) => {
  res.status(200).render('pages/register');
})

// POST register - register user into database
app.post('/register', async (req, res) => {
  console.log("attempting to register user");
  try
  {
    // does the password field match the confirm password field?
    if(req.body.password != req.body.cpassword)
    {
      throw new Error('password field does not match confirm password field');
    }

    try 
    { 
      console.log("determining if username is taken");
      // Is username already taken?
      let get_username_q = "SELECT * FROM userInfo WHERE username=$1 LIMIT 1;";
      let get_username_values = [req.body.username];
      const found_duplicate_username = await db.none(get_username_q, get_username_values);
      console.log("username not taken, inserting into database");

      try 
      {
        console.log("hashing password")
        //hash the password using bcrypt library 
        const hash = await bcrypt.hash(req.body.password, 10);

        console.log("adding to users table")
        // add user to users database table
        let insert_user_q = "INSERT INTO userInfo (first_name, last_name, email, username, password) VALUES ($1,$2,$3,$4,$5);";
        let insert_user_values = [req.body.first_name,req.body.last_name,req.body.email,req.body.username,hash];

        const added_user = await db.none(insert_user_q,insert_user_values);

        console.log("successfully registered")
        res.status(200).render('pages/login',{message:"Successfully registered!"})
      }
      catch
      {
        console.log("unexpected registration error")
        console.log(err);
        res.status(500).render('pages/login',{message:"Registration failed! Please try again."});
      }
    } 
    catch (err) 
    {
      console.log(err);
      console.log("username already exists")
      res.status(409).render('pages/register',{message:"That username already exists!"});
    }
  }
  catch (err)
  {
    console.log("Password field does not match confirm password field: \n password: " + req.body.password + "\nconfirm password: " + req.body.cpassword)
    console.log(err);
    res.status(409).render('pages/login',{message:"password field does not match confirm password field"});
  }
  
});

// Authentication Middleware.
const auth = (req, res, next) => 
{
    if (!req.session.user) {
        // Default to login page.
        console.log("no session user, redirecting to login");
        return res.redirect('login');
    }
    next();
}; 
    
// Authentication Required
app.use(auth);

app.get('/logout', async (req,res) => {
  req.session.destroy();
  res.locals.staticData.user = null;
  res.status(200).render('pages/home',{message:"Logged out successfully"});
})

app.post('/location/add', async (req, res) => {
  console.log("attempting to add or update user location");

  function isInt(value) 
  {
    if (value.match(/^\d+$/) !== null) return value;
    else return false;
  }

  function checkNull(value) 
  {
    if (typeof value === 'string') return (value === undefined || value === null || value.match(/^ *$/) !== null) ? null : value;
    else return null;
  }

  let new_location =
  {
    minhardiness: null,
    maxhardiness: null,
    watering: null,
    sunlight: null
  }

  let minHardiness = checkNull(req.body.minHardiness);
  let maxHardiness = checkNull(req.body.maxHardiness);
  let watering = checkNull(req.body.watering);
  let sunlight = checkNull(req.body.sunlight);
  const user_id = req.session.user.user_id;

  function validateInput(location)
  {
    // validate parameters
    if(minHardiness != null)
    {
      if(isInt(minHardiness)) 
      {
        minHardiness = parseInt(minHardiness);
        if(minHardiness <= 0 || minHardiness > 12)
        {
          res.status(400).render('pages/settings/location', {message: "Please enter a whole number from 1-12 for Min Hardiness",location:location});
          console.log("min hardiness invalid:",minHardiness);
          return false;
        }
      }
      else
      {
        res.status(400).render('pages/settings/location', {message: "Min Hardiness must be a number",location:location});
        console.log("min hardiness invalid:",minHardiness);
        return false;
      }
    }
    if(maxHardiness != null)
    {
      if(isInt(maxHardiness))
      {
        maxHardiness = parseInt(maxHardiness);
        if(maxHardiness <= 0 || maxHardiness > 12)
        {
          res.status(400).render('pages/settings/location', {message: "Please enter a whole number from 1-12 for Max Hardiness",location:location});
          console.log("max hardiness invalid:",maxHardiness);
          return false;
        }
      }
      else
      {
        res.status(400).render('pages/settings/location', {message: "Max Hardiness must be a number",location:location});
        console.log("max hardiness invalid:",minHardiness);
        return false;
      }
    }
    if(minHardiness != null && maxHardiness != null && minHardiness > maxHardiness)
    {
      res.status(400).render('pages/settings/location', {message: "Min Hardiness must be less than or equal to Max Hardiness",location:location});
      console.log("min hardiness greater than max hardiness");
      return false;
    }
    if(minHardiness == null && maxHardiness == null && watering == null && sunlight == null)
    {
      res.status(400).render('pages/settings/location', {message: "Please enter valid location values",location:location});
      console.log("no valid location values");
      return false;
    }
  }

  function appendQuery(query,add_comma,str)
  {
    if(add_comma) query += ", ";
    query = query + str;
    console.log("appended '" + str + "' to query")
    return query;
  }

  try
  {
    console.log("determining if user has an entry in location table");
    // determine if user has an entry in the location table already
    let q_get_location_data = `SELECT * FROM location WHERE user_id = $1;`;
    console.log("get location query:",q_get_location_data)
    const location_data = await db.one(q_get_location_data,[user_id]);

    if(validateInput(location_data) == false) return;

    // update new location data
    new_location.maxhardiness = location_data.maxhardiness;
    new_location.minhardiness = location_data.minhardiness;
    new_location.watering = location_data.watering;
    new_location.sunlight = location_data.sunlight;

    //console.log("new location data:",new_location);

    // if only minHardiness or maxHardiness is entered, check value gainst current location data
    if(minHardiness != null && maxHardiness == null && minHardiness > location_data.maxhardiness)
    {
      console.log("entered minHardiness is greater than current maxHardiness");
      res.status(400).render('pages/settings/location', {message: "Min Hardiness cannot be greater than Max Hardiness",location:location_data})
      return;
    }
    if(maxHardiness != null && minHardiness == null  && maxHardiness < location_data.minhardiness)
    {
      console.log("entered mmaxHardiness is less than current minHardiness");
      res.status(400).render('pages/settings/location', {message: "Max Hardiness cannot be less than Min Hardiness",location:location_data})
      return;
    }

    console.log("location data exists, parsing location data into update query");

    // parse location parameters into query
    let q_update_location = "UPDATE location SET ";
    let add_comma = false;

    if(minHardiness != null)
    {
      q_update_location = appendQuery(q_update_location,add_comma,`minHardiness = ${minHardiness}`);
      add_comma = true;
      new_location.minhardiness = minHardiness;
    }
    if(maxHardiness != null)
    {
      q_update_location = appendQuery(q_update_location,add_comma,`maxHardiness = ${maxHardiness}`);
      add_comma = true;
      new_location.maxhardiness = maxHardiness;
    }
    if(watering != null)
    {
      q_update_location = appendQuery(q_update_location,add_comma,`watering = '${watering}'`);
      add_comma = true;
      new_location.watering = watering;
    }
    if(sunlight != null)
    {
      q_update_location = appendQuery(q_update_location,add_comma,`sunlight = '${sunlight}'`);
      add_comma = true;
      new_location.sunlight = sunlight;
    }
    q_update_location += ` WHERE user_id = ${user_id};`;

    //console.log("update location query:",q_update_location);
    //console.log("new location data:",new_location);
    await db.none(q_update_location);
    res.status(200).render('pages/settings/location', {message: "Successfully updated user location data",location:new_location});
    console.log("successfully updated location data");
  }
  catch
  { 
    console.log("location data does not exist, parsing location data into insert query");

    new_location.minhardiness = minHardiness;
    new_location.maxhardiness = maxHardiness;
    new_location.watering = watering;
    new_location.sunlight = sunlight;

    if(validateInput(new_location) == false) return;

    // user does not have an entry in the location table, insert location data instead
    let col_names = "";
    let values = "";
    let add_comma = false;
    if(minHardiness != null) 
    {
      col_names = appendQuery(col_names,add_comma,"minhardiness");
      values = appendQuery(values,add_comma,minHardiness);
      add_comma = true;
    }
    if(maxHardiness != null)
    {
      col_names = appendQuery(col_names,add_comma,"maxhardiness");
      values = appendQuery(values,add_comma,maxHardiness);
      add_comma = true;
    }
    if(watering != null)
    {
      col_names = appendQuery(col_names,add_comma,"watering");
      values = appendQuery(values,add_comma,`'${watering}'`);
      add_comma = true;
    }
    if(sunlight != null)
    {
      col_names = appendQuery(col_names,add_comma,"sunlight");
      values = appendQuery(values,add_comma,`'${sunlight}'`);
      add_comma = true;
    }
    col_names = "(user_id, " + col_names + ")";
    values = `(${user_id}, ` + values + ")";

    //console.log("col_names:",col_names,"\nvalues:",values);

    q_insert_location = "INSERT INTO location " + col_names + " VALUES " + values + ";";
    //console.log("insert location query:",q_insert_location);

    await db.none(q_insert_location);
    console.log("successfully inserted user location data");
    res.status(200).render('pages/settings/location', {message: "Successfully added user location data",location:new_location});
    console.log("successfully inserted location data");
  }
});

app.get('/search',(req,res) => {
  res.render('pages/search',{plants: []});
});

app.post('/search', async (req,res) => {
  
  const plant_name = req.body.plantName;
  const minHeight = req.body.sizeMin;
  const maxHeight = req.body.sizeMax;
  const cycle = req.body.cycle;
  const minHardiness = req.body.minHardiness;
  const maxHardiness = req.body.maxHardiness;
  const sunlight = req.body.sunlight;
  const watering = req.body.watering;
  const flowers = req.body.flowers;
  const edible = req.body.edible;

  console.log(plant_name, " ", minHeight, " ", maxHeight, " ", cycle, " ", minHardiness, " ", maxHardiness, " ", watering, " ", sunlight, " ", flowers, " ", edible)

    try{  
      console.log("writing plant search query");
        // append the non-null search values to the query - if all values are null select all plants
        let q_get_plants = "SELECT * FROM plants";
        // if query specifiers is true, add an AND before appending next parameter
        let query_specifiers = false;

        let q_name = "";
        let q_height = "";
        let q_cycle = "";
        let q_hardiness = "";
        let q_watering = "";
        let q_sunlight = "";
        let q_flowers = "";
        let q_edible = "";

        

        if(plant_name)
        {
          q_name = ` common_name LIKE '%${plant_name}%'`;
          query_specifiers = true;
        }

        // have both min and max height - search for plants between min and max
        if(minHeight && maxHeight)
        {
          if (query_specifiers) q_height = ` AND height BETWEEN ${minHeight} AND ${maxHeight} `;
          else{
            q_height = ` height BETWEEN ${minHeight} AND ${maxHeight} `;
            query_specifiers = true;
          }
        }
          // have only min height - search for plants with height greater than min
        else if(minHeight){
          if (query_specifiers) q_height = ` AND height >= ${minHeight} `;
          else{
            q_height = ` height >= ${minHeight} `;
            query_specifiers = true;
          }
        }
          // have only max height - search for plants with height less than max
        else if(maxHeight){
          if (query_specifiers) q_height = ` AND height <= ${maxHeight} `;
          else{
            q_height = ` height <= ${maxHeight} `;
            query_specifiers = true;
          }
        }

        if(cycle)
        {
          if (query_specifiers) q_cycle = `AND cycle = '${cycle}'`;
          else{
            q_cycle = ` cycle = '${cycle}'`;
            query_specifiers = true;
          }
        }

        // have both min and max hardiness - search for plants between min and max
        if(minHardiness && maxHardiness)
        {
          if (query_specifiers) q_hardiness = ` AND hardiness BETWEEN ${minHardiness} AND ${maxHardiness}`;
          else{
            q_hardiness = ` hardiness BETWEEN ${minHardiness} AND ${maxHardiness}`;
            query_specifiers = true;            
          }
        }
          // have only min hardiness - search for plants with hardiness greater than min
        else if(minHardiness){
          if (query_specifiers) q_hardiness = ` AND hardiness >= ${minHardiness}`;
          else{
            q_hardiness = ` hardiness >= ${minHardiness}`;
            query_specifiers = true;
          }
        }
          // have only max hardiness - search for plants with hardiness less than max
        else if(maxHardiness){
          if (query_specifiers) q_hardiness = ` AND hardiness <= ${maxHardiness}`;
          else{
            q_hardiness = ` hardiness <= ${maxHardiness}`;
            query_specifiers = true;
          }
        }

        // search for watering value 'Minimum', 'Average', or 'Frequent'
        if(watering)
        {
          if (query_specifiers) q_watering = ` AND watering = '${watering}'`;
          else{
            q_watering = ` watering = '${watering}'`;
            query_specifiers = true;
          }
        }

        // search for sunlight value 'Full Shade', 'Part Shade', or 'Full Sun'
        if(sunlight)
        {
          if (query_specifiers) q_sunlight = ` AND sunlight = '${sunlight}'`;
          else{
            q_sunlight = ` sunlight = '${sunlight}'`;
            query_specifiers = true;
          }
          q_sunlight = ` AND sunlight = '${sunlight}'`;
        }

        // search for flowers true/false
        if (flowers)
        {
          if (query_specifiers) q_flowers = ` AND flowers = '${flowers}'`;
          else{
            q_flowers = ` flowers = '${flowers}'`;
            query_specifiers = true;
          }
        }
        
        // search for edible true/false
        if (edible)
        {
          if (query_specifiers) q_edible = ` AND edible = '${edible}'`;
          else{
            q_edible = ` edible = '${edible}'`;
            query_specifiers = true;
          }
        }

        if(query_specifiers) q_get_plants = q_get_plants + " WHERE" + q_name + q_height + q_cycle + q_hardiness + q_watering + q_sunlight + q_flowers + q_edible;
        q_get_plants = q_get_plants + ";"

        try
        {
          console.log("attempting to retrieve matching plants from database", q_get_plants);
          const plant_data = await db.any(q_get_plants);
          // console.log("successfully retrieved plants\n",plant_data);

          let plant_search = [];
          if(plant_data.length > 15)
          // select random plants from selected plants if there are more than 15
          {
            
            let max_idx = plant_data.length - 1;
            let idx = 0;
            for(let i = 0; i < 15; i++)
            {
              idx = Math.floor(Math.random() * max_idx);
              let plant = plant_data[idx];
              if(plant_search.includes(plant)) i--;
              else plant_search.push(plant);
            }
          }
          else plant_search = plant_data;

          res.status(200).render('pages/searchResults',{plants:plant_search})
        }
        catch (err){
          console.log(err);
          res.status(500).render('pages/searchResults',{message:"Server failed to retrieve plants from database"});
        }
      } 
      catch (err){
          console.log(err);
          res.status(500).render('pages/searchResults',{message:"Server failed to retrieve plants from database"});
        }   
});

app.get('/plantInformation', async (req,res) => {
  // get plantID from URL query
  const plant_id = req.query.plant_id;
  const plantQuery = 'SELECT * FROM plants WHERE plant_id = $1';

  try{
    // retrieve plant from database and 
    console.log("attempting to retrieve plant from database")
    const plant = await db.one(plantQuery, [plant_id]);
    console.log("successfully retrieved plant ", plant_id, "\n", plant)
    res.status(200).render('pages/plantInformation',{plant: plant});
  }
  catch (error){
    res.status(404).json({ message: 'Plant not found' });
  }

});

app.get('/profile',(req,res) => {
  res.render('pages/settings/accountSettings');
});

app.get('/setting',(req,res) => {
  res.render('pages/settings/accountSettings');
});

app.get('/removePlant', async (req,res) => {
  const plant_id = req.query.plant_id;
  try
  {
    const plantAlreadyIn = 'SELECT * FROM user_to_plants WHERE user_id = $1 AND plant_id = $2;';
    const inGarden = await db.one(plantAlreadyIn,[req.session.user.user_id, plant_id]);

    const remove = 'DELETE FROM user_to_plants WHERE user_id = $1 AND plant_id = $2;';
    await db.none(remove, [req.session.user.user_id, plant_id]);
    res.status(200).redirect('garden');
  }
  catch (error){
    res.status(404).render('pages/garden',{message:'This plant is not in your garden!',plants:user_plants});
  }
});

app.post('/addPlant', async (req,res) => {
  const plant_id = req.body.plant_id;
  console.log("attempting to add plant to user garden");
  try
  {
    let q_get_plant = "SELECT * FROM plants WHERE plant_id = $1;";
    const search_plant = await db.one(q_get_plant,[plant_id]);

    const plantAlreadyIn = 'SELECT * FROM user_to_plants WHERE user_id = $1 AND plant_id = $2;';
    

    const inGarden = await db.oneOrNone(plantAlreadyIn, [req.session.user.user_id, plant_id]);
    if(inGarden){
      return res.status(400).render('pages/plantInformation',{message: 'Already in your garden',plant:search_plant});
    }

    try
    {
      const insert = 'INSERT INTO user_to_plants (user_id, plant_id) VALUES ($1, $2);';
      await db.none(insert, [req.session.user.user_id, plant_id]);
      res.status(200).render('pages/plantInformation',{message: 'Plant added successfully',plant:search_plant});
    }
    catch (err)
    {
      console.log(err);
      res.status(500).render('pages/plantInformation',{message:"insert plant failed",plant:search_plant})
    }
  }
  catch (error){
    console.error('Failed to add plant:', error);
    res.status(500).render('pages/plantInformation',{message: 'Failed to add plant',plant:search_plant});
  }
});

app.get('/reccommendations', async (req,res) => {
  try
  {
    // get user's location data
    console.log("attempting to retrieve user location data for", req.session.username);
    
    let q_get_location_data = `SELECT * FROM userInfo INNER JOIN location ON userInfo.user_id = location.user_id WHERE userInfo.username = $1 LIMIT 1;`;
    let values_get_location_data = [req.session.username];

    const location_data = await db.oneOrNone(q_get_location_data,values_get_location_data);

    try 
    {
      if(location_data)
      {
        console.log("extracting climate data");
        // extract minHardiness, maxHardiness, watering, and sunlight values
        let minHardiness = location_data.minhardiness;
        let maxHardiness = location_data.maxhardiness;
        let watering = location_data.watering;
        let sunlight = location_data.sunlight;

        console.log("writing plant search query");
        // append the non-null search values to the query - if all values are null or location data does not exist select all plants
        let q_get_plants = "SELECT * FROM plants";
        // if query specifiers is true, add an AND before appending next parameter
        let query_specifiers = false;

        let q_hardiness = "";
        let q_watering = "";
        let q_sunlight = "";

        // have both min and max hardiness - search for plants between min and max
        if(minHardiness != null && maxHardiness != null)
        {
          q_hardiness = ` hardiness BETWEEN ${minHardiness} AND ${maxHardiness}`;
        }
        // have only min hardiness - search for plants with hardiness greater than min
        else if(minHardiness != null)
        {
          q_hardiness = ` hardiness >= ${minHardiness}`;
        }
        // have only max hardiness - search for plants with hardiness less than max
        else if(maxHardiness != null)
        {
          q_hardiness = ` hardiness <= ${maxHardiness}`;
        }
        if(q_hardiness != "") query_specifiers = true;

        // search for watering value 'Minimum', 'Average', or 'Frequent'
        if(watering != null)
        {
          q_watering = ` AND watering = '${watering}'`;
        }

        // search for sunlight value 'Full Shade', 'Part Shade', or 'Full Sun'
        if(sunlight)
        {
          q_sunlight = ` AND sunlight = '${sunlight}'`;
        }

        if(query_specifiers) q_get_plants = q_get_plants + " WHERE" + q_hardiness + q_watering + q_sunlight;
        q_get_plants = q_get_plants + ";"

        try
        {
          console.log("attempting to retrieve matching plants from database query ", q_get_plants);
          const plant_data = await db.any(q_get_plants);
          //console.log("successfully retrieved plants\n",plant_data);

          let plant_reccs = [];
          if(plant_data.length > 6)
          // select random plants from selected plants
          {
            
            let max_idx = plant_data.length - 1;
            let idx = 0;
            for(let i = 0; i < 6; i++)
            {
              idx = Math.floor(Math.random() * max_idx);
              let plant = plant_data[idx];
              if(plant_reccs.includes(plant)) i--;
              else plant_reccs.push(plant);
            }
          }
          else plant_reccs = plant_data;

          res.status(200).render('pages/reccommendations',{plants:plant_reccs})
        }
        catch (err)
        {
          console.log(err);
          res.status(500).render('pages/reccommendations',{message:"Server failed to retrieve plants from database"});
        }
      }
      else
      {
        throw new Error("No location data found for user " + res.session.user);
      }
    } 
    catch (err) 
    {
      console.log(err);
      res.status(404).render('pages/reccommendations',{message:"No location data found"});
    }
  }
  catch(err)
  {
    console.log(err); 
    res.status(500).render('pages/reccommendations',{message:"Server failed to retrieve user location data."})
  }
})

app.get('/profile',(req,res) => {
  res.render('pages/settings/profile', { title: 'Profile' });
})

app.get('/location', async (req,res) => {
  try
  {
    let q_get_location_data = `SELECT * FROM location WHERE user_id = $1;`;
    console.log("get location query:",q_get_location_data)
    const location_data = await db.one(q_get_location_data,[req.session.user.user_id]);
    console.log("location data:\n",location_data);

    res.render('pages/settings/location', {location:location_data});
  }
  catch
  {
    res.render('pages/settings/location');
  }
})

app.get('/account-settings',(req,res) => {
  res.render('pages/settings/accountSettings', { title: 'Account Settings'});
})

app.post('/updateAccount', async (req,res) => {
  console.log("attempting to update user account");
  // if string is null or all whitespace, return null, else return the string
  function checkNull(str){
    return (str=== undefined || str === null || str.match(/^ *$/) !== null) ? null : str;
  }
  let fname = checkNull(req.body.first_name);
  let lname = checkNull(req.body.last_name);
  let username = checkNull(req.body.username);
  let email = checkNull(req.body.email);
  let password = checkNull(req.body.password);
  let cpassword = checkNull(req.body.cpassword);
  
  // check if any data was entered
  if(!(fname || lname || username || email || password || cpassword))
  {
    console.log("no valid fields");
    res.status(608).render('pages/settings/accountSettings',{message:"Must enter new user data"})
    return;
  }
  // check if password matches confirm password
  if(password != cpassword) 
  {
    console.log("password does not match confirm password");
    res.status(400).render('pages/settings/accountSettings',{message:"Password and confirm password fields do not match"})
    return;
  }
  // check if a valid email was entered - look for @ symbol and .
  if(email != null && email.match(/^.+@{1}.+\..+/) == null)
  {
    console.log("email is invalid:",email);
    res.status(400).render('pages/settings/accountSettings',{message:"Please enter a valid email"})
    return;
  }
 
  try
  {
    // make sure the user account exists
    q_get_user = "SELECT * FROM userInfo WHERE user_id = $1;";
    const user_info = await db.one(q_get_user,[req.session.user.user_id]);

    try 
    {
      // check if new username is already taken
      if(username != "")
      {
        q_check4username = "SELECT * FROM userInfo WHERE username = $1;";
        await db.none(q_check4username,[username]);
      }
      
      try
      {
        let updated_user = res.locals.staticData.user;
        function appendQuery(query,add_comma,str)
        {
          if(add_comma) query = query + ", ";
          query = query + str;
          console.log("appended '" + str + "' to query")
          return query;
        }
        // construct query to update user account
        let q_update_user = "UPDATE userInfo SET ";
        let add_comma = false;
        if(fname != null) 
        {
          q_update_user = appendQuery(q_update_user,add_comma,`first_name = '${fname}'`);
          add_comma = true;
          req.session.first_name = fname;
          updated_user.first_name = fname;
        }
        if(lname != null) 
        {
          q_update_user = appendQuery(q_update_user,add_comma,`last_name = '${lname}'`);
          add_comma = true;
          req.session.last_name = lname;
          updated_user.last_name = lname;
        }
        if(username != null)
        {
          q_update_user = appendQuery(q_update_user,add_comma,`username = '${username}'`);
          add_comma = true;
          req.session.username = username;
          updated_user.username = username;
        }
        if(email != null)
        {
          q_update_user = appendQuery(q_update_user,add_comma,`email = '${email}'`);
          add_comma = true;
          req.session.email = email;
          updated_user.email = email;
        }
        if(password != null)
        {
          const hash = await bcrypt.hash(req.body.password, 10);
          q_update_user = appendQuery(q_update_user,add_comma,`password = '${hash}'`);
          add_comma = true;
        }
        q_update_user = q_update_user + ';';

        // update user account
        await db.none(q_update_user);
        req.session.save();
        res.locals.staticData.user = updated_user;
        console.log("successfully updated user info");
        res.status(200).render('pages/settings/accountSettings',{message:"Successfully updated user information"});
      }
      catch (err)
      {
        console.log(err);
        res.status(200).render('pages/settings/accountSettings',{message:"Failed to update user information"});
      }
    } 
    catch (err) 
    {
      console.log(err);
      res.status(403).render('pages/settings/accountSettings',{message:"Username is already taken"});
    }
  }
  catch (err)
  {
    console.log(err);
    res.status(404).render('pages/settings/accountSettings',{message:"User does not exist"});
  }
})

app.get('/favorite-plants',(req,res) => {
  res.render('pages/settings/favoritePlants', { title: 'Favorite Plants' });
})

app.get('/delete-account',(req,res) => {
  res.render('pages/settings/deleteAccount');
})

app.get('/delete', async (req,res) => {
  const user_id = req.session.user.user_id;

  try
  {
    // remove all entries with references to user_id in location and plant tables, then remove user
    const removeLocation = 'DELETE FROM location WHERE user_id = $1;';
    await db.none(removeLocation, [user_id]);
    const removePlant = 'DELETE FROM user_to_plants WHERE user_id = $1;';
    await db.none(removePlant, [user_id]);
    const removeUser = 'DELETE FROM userInfo WHERE user_id = $1;';
    await db.none(removeUser, [user_id]);
    console.log("user deleted successfully")
    res.status(200).redirect('logout');
  }
  catch (err){
    console.log(err)
    res.status(500).render('pages/home',{message:'Error deleting user'});
  }
});

app.get('/garden', async (req,res) => {
  console.log("attempting to retrieve plants for garden");

  console.log(req.session.user.user_id)
  try 
  {
    let q_get_plants = "SELECT * FROM user_to_plants INNER JOIN plants ON user_to_plants.plant_id = plants.plant_id WHERE user_to_plants.user_id = $1;";
    const user_plants = await db.many(q_get_plants,[req.session.user.user_id]);

    // calculate number of columns
    let cols = Math.floor(Math.sqrt(user_plants.length));
    if(cols > 5) cols = 5;
    if(cols < 2) cols = 2;
    console.log(cols);

    console.log("successfully retrieved plants");
    res.status(200).render('pages/garden',{plants:user_plants,col:cols});
  } 
  catch (err) 
  {
    console.log(err);
    res.status(404).render('pages/garden',{message:"No plant data found"})
  }
})

// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests
module.exports = app.listen(3000);
console.log('Server is listening on port 3000');
