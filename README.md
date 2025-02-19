# Green Thumb
To help our neighbors make our Earth a greener place. 

Application Description
- Green Thumb is a home gardening application designed to assist home gardeners with tracking and finding new plants for their garden. Users are able to search for plants using filters such as height, cycle, hardiness, sunlight, watering, flowers, and edible to find the best plants to match their garden. Users can then view all of these plants' attributes in a more detailed view, and add plants to their garden. Users can also view their garden, as well as get recommendations for new plants based on user-specified location attributes. This application is powered by data from the Perenual API, more information can be found at perenual.com.

Directory Structure
- MilestoneSubmissions: Contains information related to project submissions and planning information
- ProjectSourceCode: Contains all code related to the project
  - src: Contains most code related to the deployment of the website
    - init_data: Contains create/insert queries for database tables
    - resources: Contains stylization, image, and other resources used
    - views: Contains all page layouts, pages, and partials
  - test: Contains file to run test cases
- TeamMeetingLogs: Contains notes from each of the four meetings conducted throughout the project

Contributors/Team Members  
  - Alexander Eadie - xanderEadie 
  - Libo Zou - liboZou 
  - Yubo Wang - wyb7138 
  - Aria Blondeau - aria-b4 
  - Gabrielle Partch - gpartch 
  - Jack Rueschhoff - JackRueschhoff 

Technology Stack Used
- Node.js (application server), Express (framework), Docker (containerization), PostgreSQL (database), Handlebars (templating), Mocha/Chai (testing), Render (cloud hosting), Perenual (API), DaisyUI (CSS), Tailwind (CSS)

Prerequisites to run the application
- You will need to have Docker installed on your computer to run this application. Installation instructions can be found at https://docs.docker.com/get-started/get-docker/

How to run the application locally
- Clone this GitHub repository and navigate to green-thumb/ProjectSourceCode
- Create a .env file with the following contents:
  - POSTGRES_USER="postgres"
  - POSTGRES_PASSWORD="pwd"
  - POSTGRES_DB="users_db"
  - SESSION_SECRET="super duper secret!"
- Start the Docker engine and run docker compose up to start the application. The application will be accessible via http://localhost:3000
- To close the program, run docker compose down -v

How to run the tests
- The tests should run automatically each time the application is launched.
- Please note that after the first launch of the application, one of the register test cases will fail on subsequent launches due to the user already existing in the database. To resolve this issue, you will need to restart the databases along with the application by closing the application with docker compose down -v
- For the search and plantInformation tests, the authentication middleware breaks the tests as it redirects to the login page. To fix this, comment out the authentication middleware and required sections of the index.js file from lines 223-235, then uncomment the negative plantInformation tests.
  - By default the authentication middleware is enabled and plantInformation is commented out so the application will run just fine without doing anything.
 
Demo link
https://www.youtube.com/watch?v=WFUObjQTSmY

https://green-thumb-bx45.onrender.com/ (no longer works)
