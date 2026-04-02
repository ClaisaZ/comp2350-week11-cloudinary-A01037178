const router = require('express').Router();

const database = include('databaseConnectionMongoDB');
const ObjectId = require('mongodb').ObjectId;

const { v4: uuid } = require('uuid');

const cloudinary = require('cloudinary');
cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_CLOUD_KEY,
	api_secret: process.env.CLOUDINARY_CLOUD_SECRET
});

const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const mongodb_database = process.env.REMOTE_MONGODB_DATABASE;
const userCollection = database.db(mongodb_database).collection('users');
const petCollection = database.db(mongodb_database).collection('pets');

const Joi = require("joi");
const mongoSanitize = require('express-mongo-sanitize');
const bcrypt = require('bcrypt');
const saltRounds = 12;

// Hack for express 5.x not setting req.query as writable
router.use((req, _res, next) => {
	Object.defineProperty(req, 'query', {
		...Object.getOwnPropertyDescriptor(req, 'query'),
		value: req.query,
		writable: true,
	});

	next();
});

router.use(mongoSanitize({ replaceWith: '%' }));

router.get('/', async (req, res) => {
	console.log("page hit");

	try {
		const users = await userCollection
			.find()
			.project({ first_name: 1, last_name: 1, email: 1, image_id: 1, _id: 1 })
			.toArray();

		if (users === null) {
			res.render('error', { message: 'Error connecting to MongoDB' });
			console.log("Error connecting to user collection");
		} else {
			users.map((item) => {
				item.user_id = item._id;
				return item;
			});

			console.log("USERS ON HOME PAGE:");
			users.forEach((user) => {
				console.log({
					id: user._id.toString(),
					email: user.email,
					image_id: user.image_id
				});
			});
			res.render('index', {
				allUsers: users,
				cloud_name: process.env.CLOUDINARY_CLOUD_NAME
			});
		}
	} catch (ex) {
		res.render('error', { message: 'Error connecting to MongoDB' });
		console.log("Error connecting to MongoDB");
		console.log(ex);
	}
});

router.post('/setUserPic', upload.single('image'), async function (req, res) {
	try {
		if (!req.file) {
			return res.render('error', { message: 'No image file was uploaded' });
		}

		const image_uuid = uuid();
		const user_id = req.body.user_id;
		const buf64 = req.file.buffer.toString('base64');
		const mimeType = req.file.mimetype;

		const schema = Joi.object({
			user_id: Joi.string().alphanum().min(24).max(24).required()
		});

		const validationResult = schema.validate({ user_id });
		if (validationResult.error) {
			return res.render('error', { message: 'Invalid user_id' });
		}

		cloudinary.uploader.upload(
			`data:${mimeType};base64,${buf64}`,
			async function (error, result) {
				if (error) {
					console.log("Cloudinary user upload error:", error);
					return res.render('error', { message: 'Error uploading image to Cloudinary' });
				}

				try {
					await userCollection.updateOne(
						{ _id: new ObjectId(user_id) },
						{ $set: { image_id: result.public_id } }
					);

					res.redirect('/');
				} catch (ex) {
					console.log(ex);
					res.render('error', { message: 'Error saving image to MongoDB' });
				}
			},
			{ public_id: image_uuid }
		);
	} catch (ex) {
		console.log(ex);
		res.render('error', { message: 'Error uploading image' });
	}
});

router.get('/deleteUserImage', async (req, res) => {
	try {
		console.log("delete user image");

		let user_id = req.query.id;

		const schema = Joi.object({
			user_id: Joi.string().alphanum().min(24).max(24).required()
		});

		const validationResult = schema.validate({ user_id });

		if (validationResult.error) {
			console.log(validationResult.error);
			return res.render('error', { message: 'Invalid user_id' });
		}

		await userCollection.updateOne(
			{ _id: new ObjectId(user_id) },
			{ $set: { image_id: undefined } }
		);

		res.redirect('/');
	} catch (ex) {
		res.render('error', { message: 'Error connecting to MongoDB' });
		console.log("Error connecting to MongoDB");
		console.log(ex);
	}
});

router.post('/setPetPic', upload.single('image'), async function (req, res) {
	try {
		if (!req.file) {
			return res.render('error', { message: 'No image file was uploaded' });
		}

		let image_uuid = uuid();
		let pet_id = req.body.pet_id;
		let user_id = req.body.user_id;
		let buf64 = req.file.buffer.toString('base64');

		const schema = Joi.object({
			pet_id: Joi.string().alphanum().min(24).max(24).required(),
			user_id: Joi.string().alphanum().min(24).max(24).required()
		});

		const validationResult = schema.validate({ pet_id, user_id });
		if (validationResult.error) {
			return res.render('error', { message: 'Invalid pet_id or user_id' });
		}

		cloudinary.uploader.upload(
			`data:${req.file.mimetype};base64,${buf64}`,
			async function (error, result) {
				if (error) {
					console.log(error);
					return res.render('error', { message: 'Error uploading image to Cloudinary' });
				}

				try {
					await petCollection.updateOne(
						{ _id: new ObjectId(pet_id) },
						{ $set: { image_id: image_uuid } }
					);

					res.redirect(`/showPets?id=${user_id}`);
				} catch (ex) {
					console.log(ex);
					res.render('error', { message: 'Error saving image to MongoDB' });
				}
			},
			{ public_id: image_uuid }
		);
	} catch (ex) {
		console.log(ex);
		res.render('error', { message: 'Error uploading image' });
	}
});

router.get('/showPets', async (req, res) => {
	console.log("page hit");
	try {
		let user_id = req.query.id;
		console.log("userId: " + user_id);

		const schema = Joi.object({
			user_id: Joi.string().alphanum().min(24).max(24).required()
		});

		const validationResult = schema.validate({ user_id });
		if (validationResult.error != null) {
			console.log(validationResult.error);
			return res.render('error', { message: 'Invalid user_id' });
		}

		const pets = await petCollection.find({ user_id: new ObjectId(user_id) }).toArray();

		if (pets === null) {
			res.render('error', { message: 'Error connecting to MongoDB' });
			console.log("Error connecting to pet collection");
		} else {
			pets.map((item) => {
				item.pet_id = item._id;
				return item;
			});

			console.log(pets);

			res.render('pets', {
				allPets: pets,
				user_id: user_id,
				cloud_name: process.env.CLOUDINARY_CLOUD_NAME
			});
		}
	} catch (ex) {
		res.render('error', { message: 'Error connecting to MongoDB' });
		console.log("Error connecting to MongoDB");
		console.log(ex);
	}
});

router.get('/deleteUser', async (req, res) => {
	try {
		console.log("delete user");

		let user_id = req.query.id;

		const schema = Joi.object({
			user_id: Joi.string().alphanum().min(24).max(24).required()
		});

		const validationResult = schema.validate({ user_id });
		if (validationResult.error != null) {
			console.log(validationResult.error);
			return res.render('error', { message: 'Invalid user_id' });
		}

		if (user_id) {
			console.log("userId: " + user_id);
			await petCollection.deleteMany({ user_id: new ObjectId(user_id) });
			await userCollection.deleteOne({ _id: new ObjectId(user_id) });
		}

		res.redirect("/");
	} catch (ex) {
		res.render('error', { message: 'Error connecting to MongoDB' });
		console.log("Error connecting to MongoDB");
		console.log(ex);
	}
});

router.get('/deletePetImage', async (req, res) => {
	try {
		console.log("delete pet image");

		let pet_id = req.query.id;
		let user_id = req.query.user;

		const schema = Joi.object({
			user_id: Joi.string().alphanum().min(24).max(24).required(),
			pet_id: Joi.string().alphanum().min(24).max(24).required(),
		});

		const validationResult = schema.validate({ user_id, pet_id });

		if (validationResult.error != null) {
			console.log(validationResult.error);
			return res.render('error', { message: 'Invalid user_id or pet_id' });
		}

		await petCollection.updateOne(
			{ _id: new ObjectId(pet_id) },
			{ $set: { image_id: undefined } }
		);

		res.redirect(`/showPets?id=${user_id}`);
	} catch (ex) {
		res.render('error', { message: 'Error connecting to MongoDB' });
		console.log("Error connecting to MongoDB");
		console.log(ex);
	}
});

router.post('/addUser', async (req, res) => {
	try {
		console.log("form submit");

		const schema = Joi.object({
			first_name: Joi.string().alphanum().min(2).max(50).required(),
			last_name: Joi.string().alphanum().min(2).max(50).required(),
			email: Joi.string().email().min(2).max(150).required(),
			password: Joi.string().min(8).max(30).required()
		});

		const validationResult = schema.validate({
			first_name: req.body.first_name,
			last_name: req.body.last_name,
			email: req.body.email,
			password: req.body.password
		});

		if (validationResult.error != null) {
			console.log(validationResult.error);
			return res.render('error', { message: 'Invalid first_name, last_name, email' });
		}

		let hashedPassword = await bcrypt.hash(req.body.password, saltRounds);

		await userCollection.insertOne({
			first_name: req.body.first_name,
			last_name: req.body.last_name,
			email: req.body.email,
			password: hashedPassword
		});

		res.redirect("/");
	} catch (ex) {
		res.render('error', { message: 'Error connecting to MongoDB' });
		console.log("Error connecting to MongoDB");
		console.log(ex);
	}
});

router.post('/addPet', async (req, res) => {
	try {
		console.log("form submit");

		let user_id = req.body.user_id;

		const schema = Joi.object({
			user_id: Joi.string().alphanum().min(24).max(24).required(),
			name: Joi.string().alphanum().min(2).max(50).required(),
			pet_type: Joi.string().alphanum().min(2).max(150).required()
		});

		const validationResult = schema.validate({
			user_id,
			name: req.body.pet_name,
			pet_type: req.body.pet_type
		});

		if (validationResult.error != null) {
			console.log(validationResult.error);
			return res.render('error', { message: 'Invalid user_id, pet_name, or pet_type' });
		}

		await petCollection.insertOne({
			name: req.body.pet_name,
			user_id: new ObjectId(user_id),
			pet_type: req.body.pet_type,
		});

		res.redirect(`/showPets?id=${user_id}`);
	} catch (ex) {
		res.render('error', { message: 'Error connecting to MongoDB' });
		console.log("Error connecting to MongoDB");
		console.log(ex);
	}
});

module.exports = router;