const router = require('express').Router();

const database = include('databaseConnectionMongoDB');
var ObjectId = require('mongodb').ObjectId;

const crypto = require('crypto');
const {v4: uuid} = require('uuid');

const cloudinary = require('cloudinary');
cloudinary.config({ 
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
	api_key: process.env.CLOUDINARY_CLOUD_KEY,
	api_secret: process.env.CLOUDINARY_CLOUD_SECRET
});

const multer  = require('multer')
const storage = multer.memoryStorage()
const upload = multer({ storage: storage })

const mongodb_database = process.env.REMOTE_MONGODB_DATABASE;
const userCollection = database.db(mongodb_database).collection('users');
const petCollection = database.db(mongodb_database).collection('pets');

const Joi = require("joi");
const mongoSanitize = require('express-mongo-sanitize');


//Hack for express 5.x not setting req.query as writable 
router.use((req, _res, next) => {
	Object.defineProperty(req, 'query', {
		...Object.getOwnPropertyDescriptor(req, 'query'),
		value: req.query,
		writable: true,
	});

	next();
})

router.use(mongoSanitize(
    {replaceWith: '%'}
));

router.get('/', async (req, res) => {
	console.log("page hit");


	try {
		const users = await userCollection.find().project({first_name: 1, last_name: 1, email: 1, _id: 1}).toArray();

		if (users === null) {
			res.render('error', {message: 'Error connecting to MongoDB'});
			console.log("Error connecting to user collection");
		}
		else {
			users.map((item) => {
				item.user_id = item._id;
				return item;
			});
			console.log(users);

			res.render('index', {allUsers: users});
		}
	}
	catch(ex) {
		res.render('error', {message: 'Error connecting to Database'});
		console.log("Error connecting to Database");
		console.log(ex);
	}
});

router.get('/pic', async (req, res) => {
	  res.send('<form action="picUpload" method="post" enctype="multipart/form-data">'
    + '<p>Public ID: <input type="text" name="title"/></p>'
    + '<p>Image: <input type="file" name="image"/></p>'
    + '<p><input type="submit" value="Upload"/></p>'
    + '</form>');
});

router.post('/picUpload', upload.single('image'), function(req, res, next) {
	let buf64 = req.file.buffer.toString('base64');
  stream = cloudinary.uploader.upload("data:image/png;base64," + buf64, function(result) { //_stream
    console.log(result);
    res.send('Done:<br/> <img src="' + result.url + '"/><br/>' +
             cloudinary.image(result.public_id, { format: "png", width: 100, height: 130, crop: "fit" }));
  }, { public_id: req.body.title } );
  console.log(req.body);
  console.log(req.file);

});

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

router.post('/setPetPic', upload.single('image'), function(req, res, next) {
	let image_uuid = uuid();
	let pet_id = req.body.pet_id;
	let user_id = req.body.user_id;
	let buf64 = req.file.buffer.toString('base64');
	stream = cloudinary.uploader.upload("data:image/octet-stream;base64," + buf64, async function(result) { 
			try {
				console.log(result);

				console.log("userId: "+user_id);


				// Joi validate
				const schema = Joi.object(
				{
					pet_id: Joi.string().alphanum().min(24).max(24).required(),
					user_id: Joi.string().alphanum().min(24).max(24).required()
				});
			
				const validationResult = schema.validate({pet_id, user_id});
				if (validationResult.error != null) {
					console.log(validationResult.error);

					res.render('error', {message: 'Invalid pet_id or user_id'});
					return;
				}				
				const success = await petCollection.updateOne({"_id": new ObjectId(pet_id)},
					{$set: {image_id: image_uuid}},
					{}
				);

				if (!success) {
					res.render('error', {message: 'Error uploading pet image to MongoDB'});
					console.log("Error uploading pet image");
				}
				else {
					res.redirect(`/showPets?id=${user_id}`);
				}
			}
			catch(ex) {
				res.render('error', {message: 'Error connecting to MongoDB'});
				console.log("Error connecting to MongoDB");
				console.log(ex);
			}
		}, 
		{ public_id: image_uuid }
	);
	console.log(req.body);
	console.log(req.file);
});

router.get('/showPets', async (req, res) => {
	console.log("page hit");
	try {
		let user_id = req.query.id;
		console.log("userId: "+user_id);

		// Joi validate
		const schema = Joi.object(
			{
				user_id: Joi.string().alphanum().min(24).max(24).required()
			});
		
		const validationResult = schema.validate({user_id});
		if (validationResult.error != null) {
			console.log(validationResult.error);

			res.render('error', {message: 'Invalid user_id'});
			return;
		}				
		const pets = await petCollection.find({"user_id": new ObjectId(user_id)}).toArray();

		if (pets === null) {
			res.render('error', {message: 'Error connecting to MongoDB'});
			console.log("Error connecting to userModel");
		}
		else {
			pets.map((item) => {
				item.pet_id = item._id;
				return item;
			});			
			console.log(pets);
			res.render('pets', {allPets: pets, user_id: user_id});
		}
	}
	catch(ex) {
		res.render('error', {message: 'Error connecting to MongoDB'});
		console.log("Error connecting to MongoDB");
		console.log(ex);
	}
});

router.get('/deleteUser', async (req, res) => {
	try {
		console.log("delete user");

		let user_id = req.query.id;

		const schema = Joi.object(
			{
				user_id: Joi.string().alphanum().min(24).max(24).required()
			});
		
		const validationResult = schema.validate({user_id});
		if (validationResult.error != null) {
			console.log(validationResult.error);

			res.render('error', {message: 'Invalid user_id'});
			return;
		}				

		if (user_id) {
			console.log("userId: "+user_id);
			const result1 = await petCollection.deleteMany({"user_id": new ObjectId(user_id)});
			const result2 = await userCollection.deleteOne({"_id": new ObjectId(user_id)});

			console.log("deleteUser: ");
		}
		res.redirect("/");
	}
	catch(ex) {
		res.render('error', {message: 'Error connecting to MongoDB'});
		console.log("Error connecting to MongoDB");
		console.log(ex);	
	}
});

router.get('/deletePetImage', async (req, res) => {
	try {
		console.log("delete pet image");

		let pet_id = req.query.id;
		let user_id = req.query.user;

		const schema = Joi.object(
			{
				user_id: Joi.string().alphanum().min(24).max(24).required(),
				pet_id: Joi.string().alphanum().min(24).max(24).required(),
			});
		
		const validationResult = schema.validate({user_id, pet_id});
		
		if (validationResult.error != null) {
			console.log(validationResult.error);

			res.render('error', {message: 'Invalid user_id or pet_id'});
			return;
		}				

		if (pet_id) {
			console.log("petId: "+pet_id);
			const success = await petCollection.updateOne({"_id": new ObjectId(pet_id)},
				{$set: {image_id: undefined}},
				{}
			);

			console.log("delete Pet Image: ");
			console.log(success);
			if (!success) {
				res.render('error', {message: 'Error connecting to MySQL'});
				return;
			}
		}
		res.redirect(`/showPets?id=${user_id}`);
	}
	catch(ex) {
		res.render('error', {message: 'Error connecting to MySQL'});
		console.log("Error connecting to MySQL");
		console.log(ex);	
	}
});

const bcrypt = require('bcrypt');
const saltRounds = 12;

router.post('/addUser', async (req, res) => {
	try {
		console.log("form submit");

		const schema = Joi.object(
			{
				first_name: Joi.string().alphanum().min(2).max(50).required(),
				last_name: Joi.string().alphanum().min(2).max(50).required(),
				email: Joi.string().email().min(2).max(150).required(),
				password: Joi.string().min(8).max(30).required()
			});
		
		const validationResult = schema.validate({first_name: req.body.first_name, last_name: req.body.last_name, email: req.body.email, password: req.body.password});
		
		if (validationResult.error != null) {
			console.log(validationResult.error);

			res.render('error', {message: 'Invalid first_name, last_name, email'});
			return;
		}

	    let hashedPassword = await bcrypt.hash(req.body.password, saltRounds);

		await userCollection.insertOne(
			{	
				first_name: req.body.first_name,
				last_name: req.body.last_name,
				email: req.body.email,
				password: hashedPassword
			}
		);

		res.redirect("/");
	}
	catch(ex) {
		res.render('error', {message: 'Error connecting to MySQL'});
		console.log("Error connecting to MySQL");
		console.log(ex);	
	}
});


router.post('/addPet', async (req, res) => {
	try {
		console.log("form submit");

		let user_id = req.body.user_id;

		const schema = Joi.object(
			{
				user_id: Joi.string().alphanum().min(24).max(24).required(),
				name: Joi.string().alphanum().min(2).max(50).required(),
				pet_type: Joi.string().alphanum().min(2).max(150).required()
			});
		
		const validationResult = schema.validate({user_id, name: req.body.pet_name, pet_type: req.body.pet_type});
		
		if (validationResult.error != null) {
			console.log(validationResult.error);

			res.render('error', {message: 'Invalid first_name, last_name, email, password'});
			return;
		}				


		await petCollection.insertOne(
			{	
				name: req.body.pet_name,
				user_id: new ObjectId(user_id),
				pet_type: req.body.pet_type,
			}
		);

		res.redirect(`/showPets?id=${user_id}`);
	}
	catch(ex) {
		res.render('error', {message: 'Error connecting to MySQL'});
		console.log("Error connecting to MySQL");
		console.log(ex);	
	}
});

module.exports = router;
