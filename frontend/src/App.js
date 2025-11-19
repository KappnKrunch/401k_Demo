import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE = 'http://localhost:5000/api';

function App() {
  const [settings, setSettings] = useState({ contribution_type: 'fixed', contribution_value: 250 });
  const [ytdData, setYtdData] = useState({ totalYTD: 0, contributions: [] });
  const [retirementImpact, setRetirementImpact] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadUserSettings();
    loadYTDContributions();
    calculateRetirementImpact();
  }, []);

  useEffect(() => {
    calculateRetirementImpact();
  }, [settings.contribution_value, settings.contribution_type, , ytdData.totalYTD]);

  const loadUserSettings = async () => {
    try {
      const response = await axios.get(`${API_BASE}/user-settings`);
      setSettings(response.data);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const loadYTDContributions = async () => {
    try {
      const response = await axios.get(`${API_BASE}/ytd-contributions`);
      setYtdData(response.data);
    } catch (error) {
      console.error('Error loading YTD data:', error);
    }
  };

  const calculateRetirementImpact = async () => {
    try {
      const response = await axios.get(`${API_BASE}/retirement-impact`, {
        params: {
          currentContribution: settings.contribution_value,
          contributionType: settings.contribution_type,
          currentAge: settings.age,
          salary: settings.salary,
          retirementAge: settings.retirement_age,
          currentSavings: ytdData.totalYTD
        }
      });
      setRetirementImpact(response.data);
    } catch (error) {
      console.error('Error calculating retirement impact:', error);
    }
  };

  const handleSettingsUpdate = async (newSettings) => {
    setIsLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/user-settings`, newSettings);
      setSettings(newSettings);
      console.log('Settings updated:', response.data);
    } catch (error) {
      console.error('Error updating settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContributionTypeChange = (type) => {
    const newSettings = { ...settings, contribution_type: type };
    if (type === 'percentage') {
      newSettings.contribution_value = 5.0;
    } else {
      newSettings.contribution_value = 250;
    }
    handleSettingsUpdate(newSettings);
  };

  const handleContributionValueChange = (value) => {
    const newSettings = { ...settings, contribution_value: parseFloat(value) };
    setSettings(newSettings);

    // Debounce the API call
    clearTimeout(settings.debounceTimer);
    newSettings.debounceTimer = setTimeout(() => {
      handleSettingsUpdate(newSettings);
    }, 500);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <div className="App">
      <div className="container">
        <header className="app-header">
          <h1>401(k) Contribution Settings</h1>
          <p>Manage your retirement savings contributions</p>
        </header>

        <div className="dashboard">
          {/* YTD Summary */}
          <div className="card ytd-summary">
            <h2>Year-to-Date Summary</h2>
            <div className="ytd-amount">{formatCurrency(ytdData.totalYTD)}</div>
            <p>Total Value</p>
          </div>

          {/* Contribution Settings */}
          <div className="card contribution-settings">
            <h2>Contribution Settings</h2>
            
            <div className="contribution-type">
              <label>Contribution Type:</label>
              <div className="toggle-buttons">
                <button
                  className={settings.contribution_type === 'percentage' ? 'active' : ''}
                  onClick={() => handleContributionTypeChange('percentage')}
                >
                  Percentage of Paycheck
                </button>
                <button
                  className={settings.contribution_type === 'fixed' ? 'active' : ''}
                  onClick={() => handleContributionTypeChange('fixed')}
                >
                  Fixed Amount
                </button>
              </div>
            </div>

            <div className="contribution-slider">
              <label>
                {settings.contribution_type === 'percentage' 
                  ? `Contribution Percentage: ${settings.contribution_value}%`
                  : `Fixed Amount: ${formatCurrency(settings.contribution_value)} per paycheck`
                }
              </label>
              <input
                type="range"
                min={settings.contribution_type === 'percentage' ? 0.1 : 10}
                max={settings.contribution_type === 'percentage' ? 100 : 6000}
                step={settings.contribution_type === 'percentage' ? 0.1 : 50}
                value={settings.contribution_value}
                onChange={(e) => handleContributionValueChange(e.target.value)}
                disabled={isLoading}
              />
              <div className="slider-labels">
                <span>
                  {settings.contribution_type === 'percentage' ? '0%' : formatCurrency(10)}
                </span>
                <span>
                  {settings.contribution_type === 'percentage' ? '100%' : formatCurrency(6000)}
                </span>
              </div>
            </div>

            {/* Manual Input */}
            <div className="manual-input">
              <label>Or enter specific amount:</label>
              <div className="input-group">
                {settings.contribution_type === 'percentage' ? (
                  <>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      step="0.1"
                      value={settings.contribution_value}
                      onChange={(e) => handleContributionValueChange(e.target.value)}
                      disabled={isLoading}
                    />
                    <span>%</span>
                  </>
                ) : (
                  <>
                    <span>$</span>
                    <input
                      type="number"
                      min="10"
                      max="10000"
                      step="10"
                      value={settings.contribution_value}
                      onChange={(e) => handleContributionValueChange(e.target.value)}
                      disabled={isLoading}
                    />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Retirement Impact */}
          {retirementImpact && (
            <div className="card retirement-impact">
              <h2>Retirement Impact</h2>
              <div className="impact-details">
                <p>
                  Without contributions, future value is estimated at{' '}
                  <strong>{formatCurrency(retirementImpact.futureValueOfCurrent)}</strong>
                </p>
                <p>
                  Contributing {formatCurrency(retirementImpact.annualContribution)} annually.
                </p>
                <p>
                  Could grow to approximately{' '}
                  <strong>{formatCurrency(retirementImpact.estimatedSavings)}</strong> by age {retirementImpact.retirementAge}.
                </p>
                <div className="impact-note">
                  <small>
                    *Estimate assumes 5% annual growth and consistent contributions until age {retirementImpact.retirementAge}
                  </small>
                </div>
                
              </div>
            </div>
          )}

          {/* Recent Contributions */}
          <div className="card recent-contributions">
            <h2>Recent Contributions</h2>
            <div className="contributions-list">
              {ytdData.contributions.slice(-9).map(contribution => (
                <div key={contribution.id} className="contribution-item">
                  <span className="date">{new Date(contribution.date).toLocaleDateString()}</span>
                  <span className="amount">{formatCurrency(contribution.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;