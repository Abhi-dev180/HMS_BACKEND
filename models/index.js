// const fs = require('fs');
// const path = require('path');

// const dbPath = path.join(__dirname, '../data/db.json');

// const readDB = () => {
//   try {
//     const data = fs.readFileSync(dbPath, 'utf8');
//     return JSON.parse(data);
//   } catch (error) {
//     console.error('Error reading db:', error);
//     return { users: [], hospitals: [], appointments: [] };
//   }
// };

// const writeDB = (data) => {
//   try {
//     fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
//   } catch (error) {
//     console.error('Error writing to db:', error);
//   }
// };

// module.exports = {
//   readDB,
//   writeDB
// };


// const fs = require('fs');
// const path = require('path');

// const dbPath = path.join(__dirname, '../data/db.json');

// const readDB = () => {
//   try {
//     if (!fs.existsSync(dbPath)) {
//       return { users: [], hospitals: [], appointments: [], contacts: [] };
//     }
//     const data = fs.readFileSync(dbPath, 'utf8');
//     const parsed = JSON.parse(data);
//     return {
//       users: parsed.users || [],
//       hospitals: parsed.hospitals || [],
//       appointments: parsed.appointments || [],
//       contacts: parsed.contacts || [],
//     };
//   } catch (error) {
//     console.error('Error reading db:', error);
//     return { users: [], hospitals: [], appointments: [], contacts: [] };
//   }
// };

// const writeDB = (data) => {
//   try {
//     fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
//   } catch (error) {
//     console.error('Error writing to db:', error);
//   }
// };

// module.exports = {
//   readDB,
//   writeDB,
// };


const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../data/db.json');

const getDefaultDB = () => ({
  users: [],
  hospitals: [],
  appointments: [],
  contacts: [],
  feedbacks: [],
  calls: [],
  transcriptions: []
});

const readDB = () => {
  try {
    if (!fs.existsSync(dbPath)) {
      return getDefaultDB();
    }

    const data = fs.readFileSync(dbPath, 'utf8');
    const parsed = JSON.parse(data);

    return {
      users: parsed.users || [],
      hospitals: parsed.hospitals || [],
      appointments: parsed.appointments || [],
      contacts: parsed.contacts || [],
      feedbacks: parsed.feedbacks || [],
      calls: parsed.calls || [],
      transcriptions: parsed.transcriptions || []
    };
  } catch (error) {
    console.error('Error reading db:', error);
    return getDefaultDB();
  }
};

const writeDB = (data) => {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing to db:', error);
  }
};

module.exports = {
  readDB,
  writeDB
};