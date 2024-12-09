// ********************** Initialize server **********************************

const server = require('../src/index.js'); //TODO: Make sure the path to your index.js is correctly added

// ********************** Import Libraries ***********************************

const chai = require('chai'); // Chai HTTP provides an interface for live integration testing of the API's.
const chaiHttp = require('chai-http');
chai.should();
chai.use(chaiHttp);
const {assert, expect} = chai;

// ********************** DEFAULT WELCOME TESTCASE ****************************

describe('Server!', () => {
  // Sample test case given to test / endpoint.
  it('Returns the default welcome message', done => {
    chai
      .request(server)
      .get('/welcome')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.status).to.equals('success');
        assert.strictEqual(res.body.message, 'Welcome!');
        done();
      });
  });
});

//  *********************** TODO: WRITE 2 UNIT TESTCASES **************************

// Example Positive Testcase :
// API: /add_user
// Input: {id: 5, name: 'John Doe', dob: '2020-02-20'}
// Expect: res.status == 200 and res.body.message == 'Success'
// Result: This test case should pass and return a status 200 along with a "Success" message.
// Explanation: The testcase will call the /add_user API with the following input
// and expects the API to return a status of 200 along with the "Success" message.


 // TODO: figure out how to send both a status code and a json message that can be read by the test case to differentiate between different responses w/ same status code - see both 409 responses in /register tests
describe('test register API', () => {
  // WARNING - will only pass when initially starting db, otherwise it'll already be in the db and fail - TODO: any way to mitigate this?
 it('[positive : /register] register a valid user', done => {
   chai
     .request(server)
     .post('/register')
     .send({username: 'john_doe',password:'12345', cpassword: '12345',first_name: 'john', last_name: 'doe', email: 'jdoe@gmail.com'})
     .end((err, res) => {
      expect(res).to.have.status(200);
       done();
    });
});
it('[negative : /register] register an invalid user - duplicate', done => {
    chai
  .request(server)
  .post('/register')
  .send({username: 'john_doe',password:'12345', cpassword: '12345',first_name: 'john', last_name: 'doe', email: 'jdoe@gmail.com'})
  .end((err, res) => {
    expect(res).to.have.status(409);
    done();
  });
});
  it('[negative : /register] register an invalid user - password and confirm password fields are different', done => {
    chai
      .request(server)
      .post('/register')
      .send({username: 'bob_ross',password:'12345', cpassword: '54321',first_name: 'bob', last_name: 'ross', email: 'bross@gmail.com'})
      .end((err, res) => {
        expect(res).to.have.status(409);
        done();
      });
  });
});


describe('test login API', () => {
  it('[positive : /login] login a valid user', done => {
    chai
    .request(server)
    .post('/login')
    .send({username: 'john_doe',password:'12345', cpassword: '12345',first_name: 'john', last_name: 'doe', email: 'jdoe@gmail.com'})
    .end((err, res) => {
      expect(res).to.have.status(200);
      done();
    });
  });
  it('[negative : /login] login an invalid user - user does not exist', done => {
    chai
    .request(server)
    .post('/login')
    .send({username: 'some_guy',password:'h@ck3r', cpassword: 'h@ck3r',first_name: 'john', last_name: 'smith', email: 'jsm@gmail.com'})
    .end((err, res) => {
      expect(res).to.have.status(404);
      done();
    });
  });
})

// THE BELOW TESTS WILL ALL FAIL IF THE AUTHENTICATION MIDDLEWARE IS NOT COMMENTED OUT
// COMMENT OUT THE AUTHENTICATION MIDDLEWARE AND AUTHENTICATION REQUIRED SECTIONS OF THE INDEX.JS FILE FOR THE BELOW CASES TO WORK
describe('test search API', () => {
    it('[positive : /search] search for a known plant', done => {
     chai
      .request(server)
      .post('/search')
      .send({cycle: 'Perennial',flowers:'false', edible: 'true'})
      .end((err, res) => {
        expect(res).to.have.status(200);
        done();
      });
    });
})


describe('test plantInformation API', () => {
    it('[positive : /plantInformation] view valid plant information', done => {
      chai
      .request(server)
      .get('/plantInformation?plant_id=39')
      .end((err, res) => {
        expect(res).to.have.status(200);
        done();
      });
    });
    /* 
    // Uncomment this test case when the authentication middleware is disabled
    // If uncommented while the authentication middleware is enabled, the app will fail to run.
    it('[negative : /plantInformation] view invalid plant information', done => {
      chai
      .request(server)
      .get('/plantInformation?plant_id=999')
      .end((err, res) => {
        expect(res).to.have.status(404);
        done();
      });
    });
    */
  })
// ********************************************************************************
