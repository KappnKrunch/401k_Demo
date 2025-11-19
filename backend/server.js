const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());

// Initialize SQLite database
const db = new sqlite3.Database(':memory:');

// Create tables and seed initial data
db.serialize(() => {
  db.run(`CREATE TABLE user_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contribution_type TEXT CHECK(contribution_type IN ('percentage', 'fixed')) DEFAULT 'fixed',
    contribution_value REAL DEFAULT 250.0,
    age INTEGER DEFAULT 30,
    salary REAL DEFAULT 80000.0,
    retirement_age INTERGER DEFAULT 65,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE contribution_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    amount REAL,
    type TEXT
  )`);

  // Insert initial user settings
  // db.run(`INSERT INTO user_settings (contribution_type, contribution_value) VALUES ('percentage', 5.0)`);

  // Seed some mock YTD data
  const mockContributions = [
    ['2025-01-15', 250, 'contribution'],
    ['2025-02-15', 250, 'contribution'],
    ['2025-03-15', 250, 'contribution'],
    ['2025-04-15', 250, 'contribution'],
    ['2025-05-15', 250, 'contribution'],
    ['2025-06-15', 250, 'contribution']
    ['2025-07-15', 250, 'contribution'],
    ['2025-08-15', 250, 'contribution'],
    ['2025-09-15', 250, 'contribution'],
    ['2025-010-15', 250, 'contribution'],
    ['2025-011-15', 250, 'contribution']
  ];

  const stmt = db.prepare(`INSERT INTO contribution_history (date, amount, type) VALUES (?, ?, ?)`);
  mockContributions.forEach(contribution => {
    stmt.run(contribution);
  });
  stmt.finalize();
});

// API Routes
app.get('/api/user-settings', (req, res) => {
  db.get(`SELECT * FROM user_settings ORDER BY id DESC LIMIT 1`, (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    // Return default values if no settings exist
    res.json(row || { 
      contribution_type: 'fixed', 
      contribution_value: 250,
      age: 30,
      salary: 80000,
      retirement_age: 65
    });
  });
});

app.post('/api/user-settings', (req, res) => {
  const { 
    contribution_type, 
    contribution_value, 
    age, 
    salary, 
    retirement_age 
  } = req.body;
  
  // Validate required fields
  if (!contribution_type || contribution_value === undefined) {
    return res.status(400).json({ error: 'Contribution type and value are required' });
  }

  db.run(
    `INSERT INTO user_settings 
     (contribution_type, contribution_value, age, salary, retirement_age) 
     VALUES (?, ?, ?, ?, ?)`,
    [contribution_type, contribution_value, age, salary, retirement_age],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      // Return the complete saved data
      res.json({ 
        id: this.lastID,
        contribution_type,
        contribution_value,
        age: age || 30,
        salary: salary || 80000,
        retirement_age: retirement_age || 65,
        message: 'Settings updated successfully'
      });
    }
  );
});

app.get('/api/ytd-contributions', (req, res) => {
  db.all(`SELECT * FROM contribution_history WHERE type = 'contribution'`, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    const totalYTD = rows.reduce((sum, row) => sum + row.amount, 0);
    res.json({
      contributions: rows,
      totalYTD: totalYTD
    });
  });
});

app.get('/api/retirement-impact', (req, res) => {
  const { currentContribution, contributionType, currentAge, salary, retirementAge, currentSavings = 0 } = req.query;

  // Validate required parameters
  if (!currentContribution || !contributionType || !currentAge || !salary || !retirementAge) {
    return res.status(400).json({ 
      error: 'Missing required parameters: currentContribution, contributionType, currentAge, salary, retirementAge' 
    });
  }

  // Parse inputs
  const r = 0.05;  // 5% estimated growth rate
  const yearsToRetire = retirementAge - currentAge;
  const parsedCurrentSavings = parseFloat(currentSavings) || 0;
  const parsedCurrentContribution = parseFloat(currentContribution);
  const parsedSalary = parseFloat(salary);

  // Calculate future value of CURRENT savings (compounded growth)
  const futureValueOfCurrent = parsedCurrentSavings * Math.pow(1 + r, yearsToRetire);

  let annualContribution;
  let futureValueOfContributions;

  // Future value of regular contributions (annuity);   FV = P * [(1 + r)^n - 1] / r
  if (contributionType === 'percentage') {
    annualContribution = (parsedCurrentContribution / 100) * parsedSalary;
    futureValueOfContributions = annualContribution * ((Math.pow(1 + r, yearsToRetire) - 1) / r);
    
  } else if (contributionType === 'fixed') {
    annualContribution = parsedCurrentContribution * 12; // Monthly to annual
    futureValueOfContributions = annualContribution * ((Math.pow(1 + r, yearsToRetire) - 1) / r);
  }

  const totalFutureValue = futureValueOfCurrent + futureValueOfContributions;
  const totalContributions = annualContribution * yearsToRetire;
  const investmentGrowth = totalFutureValue - (parsedCurrentSavings + totalContributions);

  res.json({
    currentAge: parseInt(currentAge),
    retirementAge: parseInt(retirementAge),
    annualContribution: Math.round(annualContribution),
    estimatedSavings: Math.round(totalFutureValue),
    futureValueOfCurrent: Math.round(futureValueOfCurrent),
    futureValueOfContributions: Math.round(futureValueOfContributions),
    totalContributions: Math.round(totalContributions),
    investmentGrowth: Math.round(investmentGrowth),
    yearsToRetirement: yearsToRetire,
    annualReturnRate: r
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});