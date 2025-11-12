const express = require('express');
const router = express.Router();
const Study = require('../sequelize-models/study'); // We import your new "recipe" (the Study model)

// const authMiddleware = require('../middleware/auth'); // We will add security to this later

// ---
// CREATE A NEW STUDY (POST /)
// This will be the endpoint for your "Next" button
// ---

// We will add 'authMiddleware' here later to protect it
router.post('/', async (req, res) => {
  try {
    // 1. Get the data from the frontend's request (the "order")
    const { title, description, criteria, isBlinded } = req.body;

    // 2. Get the logged-in user's ID
    // TODO: We need to get the researcher's ID from their login token.
    // For now, we will HARDCODE it to '1' just to make it work.
    // We can fix this later.
    const researcherId = 1; 

    // 3. Use Sequelize to create the new study in the database
    // This uses your study.js model!
    const newStudy = await Study.create({
      title: title,
      description: description,
      criteria: criteria, // Your model will save this as JSON!
      status: 'draft',    // We set the default status
      researcherId: researcherId,
      // 'isBlinded' is not in your model, so we can't save it yet.
      // We can store it in the 'metadata' field you created.
      metadata: { 
        isBlinded: isBlinded 
      }
    });

    // 4. Send the new study back to the frontend as a "success" message
    res.status(201).json(newStudy);

  } catch (error) {
    console.error('Error creating study:', error);
    res.status(500).json({ message: 'Server error while creating study' });
  }
});

// We must export the router, just like in your other files
module.exports = router;