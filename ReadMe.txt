Works on a Mongo DB so the database doesn't need to be created in advance.

Need to create your own Cloudinary account https://cloudinary.com/console/.
Populate your .env file with the following 3 variables from your cloudindary account.
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_CLOUD_KEY=
CLOUDINARY_CLOUD_SECRET=

To Install:
npm i

To run: 
node index.js
--OR--
nodemon index.js

On the pets page (http://localhost:3000/), you can create a new user.
Once you have a new user, click on the paw icon to add a new pet.

The new pet will not yet have an image yet. 
In order to add an image, browse for an image file and click upload.
The image should be uploaded to cloudinary and should show up next to the pet.

Click on the eraser icon next to a pet's image to delete the image (sets the image_id column to NULL).
You will see the upload button again, if the image_id column is NULL.
