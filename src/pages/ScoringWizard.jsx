import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getEvent, getTable, saveGame, recordHistory } from '../lib/firestore';
import { useEdit } from '../context/EditContext';
import { calculateScores } from '../lib/scoring';

export default function ScoringWizard() {
  const { eventId, tableId, roundId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [table, setTable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Scoring mode
  const [step, setStep] = useState('mode');
  const [scoringMode, setScoringMode] = useState(null); // 'manual' | 'wizard'

  // Manual mode state
  const [manualScores, setManualScores] = useState(['', '', '', '']);
  const [manualHandName, setManualHandName] = useState('');

  // Wizard mode state
  const [isWallGame, setIsWallGame] = useState(null);
  const [winnerId, setWinnerId] = useState(null);
  const [handName, setHandName] = useState('');
  const [basePoints, setBasePoints] = useState('');
  const [noJokers, setNoJokers] = useState(null);
  const [selfDraw, setSelfDraw] = useState(null);
  const [exposures, setExposures] = useState(null);
  const [isQuints, setIsQuints] = useState(null);
  const [discarderId, setDiscarderId] = useState(null);

  useEffect(() => {
    async function load() {
      const [evt, tbl] = await Promise.all([getEvent(eventId), getTable(eventId, tableId)]);
      setEvent(evt);
      setTable(tbl);
      setLoading(false);
    }
    load();
  }, [eventId, tableId]);

  function wizardScores() {
    return calculateScores({
      isWallGame,
      winnerId: Number(winnerId),
      basePoints: Number(basePoints),
      noJokers,
      selfDraw,
      exposures: Number(exposures),
      isQuints,
      discarderId: discarderId !== null ? Number(discarderId) : null,
    });
  }

  function finalScores() {
    if (scoringMode === 'manual') return manualScores.map(Number);
    return wizardScores();
  }

  function manualWinnerId() {
    // Only consider real (named) players
    const realIndices = players.map((p, i) => ({ p, i })).filter(({ p }) => p.name).map(({ i }) => i);
    const scores = manualScores.map(Number);
    const max = Math.max(...realIndices.map((i) => scores[i]));
    return realIndices.find((i) => scores[i] === max) ?? realIndices[0];
  }

  async function handleFinish() {
    setSaving(true);
    const scores = finalScores();

    let gameData;
    if (scoringMode === 'manual') {
      const wId = manualWinnerId();
      gameData = {
        scoringMode: 'manual',
        isWallGame: null,
        winnerId: wId,
        handName: manualHandName || null,
        basePoints: null,
        noJokers: null,
        selfDraw: null,
        exposures: null,
        isQuints: null,
        discarderId: null,
        scores,
      };
      const gameId = await saveGame(eventId, tableId, roundId, gameData);
      const winner = table.players[wId];
      if (winner?.uid) {
        await recordHistory(winner.uid, {
          eventId,
          eventName: event?.name || '',
          tableId,
          roundId,
          gameId,
          handName: manualHandName || null,
          points: scores[wId],
        });
      }
      navigate(`/event/${eventId}/table/${tableId}`);
      return;
    } else {
      gameData = {
        scoringMode: 'wizard',
        isWallGame,
        winnerId: isWallGame ? null : Number(winnerId),
        handName: isWallGame ? null : handName,
        basePoints: isWallGame ? null : Number(basePoints),
        noJokers: isWallGame ? null : noJokers,
        selfDraw: isWallGame ? null : selfDraw,
        exposures: (isWallGame || selfDraw) ? null : Number(exposures),
        isQuints: (isWallGame || selfDraw) ? null : isQuints,
        discarderId: (isWallGame || selfDraw) ? null : Number(discarderId),
        scores,
      };

      // Record history for account-holding winners
      if (!isWallGame) {
        const winner = table.players[Number(winnerId)];
        if (winner?.uid) {
          const gameId = await saveGame(eventId, tableId, roundId, gameData);
          await recordHistory(winner.uid, {
            eventId,
            eventName: event?.name || '',
            tableId,
            roundId,
            gameId,
            handName,
            points: scores[Number(winnerId)],
          });
          navigate(`/event/${eventId}/table/${tableId}`);
          return;
        }
      }
    }

    await saveGame(eventId, tableId, roundId, gameData);
    navigate(`/event/${eventId}/table/${tableId}`);
  }

  if (loading) return <div className="loading">Loading…</div>;
  if (!table) return <div className="page"><p>Table not found.</p></div>;

  const players = table.players || [];
  const realPlayers = players.map((p, i) => ({ ...p, index: i })).filter((p) => p.name);
  const manualValid = realPlayers.every((p) => manualScores[p.index] !== '' && !isNaN(Number(manualScores[p.index])));

  return (
    <div className="page">
      <header className="page-header">
        <h1>Score game</h1>
        <div className="players-chips">
          {players.map((p, i) => <span key={i} className="chip">{p.name}</span>)}
        </div>
      </header>

      <main className="page-main">
        <div className="wizard-card card">

          {step === 'mode' && (
            <WizardStep title="How would you like to enter scores?">
              <div className="btn-group vertical">
                <button className="btn-primary" onClick={() => { setScoringMode('wizard'); setStep('wall'); }}>
                  Use points wizard
                </button>
                <button className="btn-secondary" onClick={() => { setScoringMode('manual'); setStep('manual'); }}>
                  Assign points yourself
                </button>
              </div>
            </WizardStep>
          )}

          {step === 'manual' && (
            <WizardStep title="Enter points for each player" onBack={() => setStep('mode')}>
              <p className="step-hint">Enter the score for each player. Use negative numbers for losses.</p>
              <div className="manual-scores">
                {realPlayers.map((p) => (
                  <label key={p.index}>
                    {p.name}
                    <input
                      type="number"
                      value={manualScores[p.index]}
                      onChange={(e) => {
                        const updated = [...manualScores];
                        updated[p.index] = e.target.value;
                        setManualScores(updated);
                      }}
                      placeholder="0"
                    />
                  </label>
                ))}
              </div>
              <button
                className="btn-primary mt"
                disabled={!manualValid}
                onClick={() => setStep('manual_hand')}
              >
                Next
              </button>
            </WizardStep>
          )}

          {step === 'manual_hand' && (
            <WizardStep title="What hand did they win with?" onBack={() => setStep('manual')}>
              <p className="step-hint">
                Based on the points entered, <strong>{players[manualWinnerId()]?.name}</strong> is the winner.
              </p>
              <label>
                Winning hand
                <input
                  value={manualHandName}
                  onChange={(e) => setManualHandName(e.target.value)}
                  placeholder="e.g. 2468, Like Numbers…"
                />
              </label>
              <button className="btn-primary mt" onClick={() => setStep('confirm')}>
                Next
              </button>
            </WizardStep>
          )}

          {step === 'wall' && (
            <WizardStep title="Was it a wall game?" onBack={() => setStep('mode')}>
              <p className="step-hint">A wall game means all tiles were drawn and no one won.</p>
              <div className="btn-group">
                <button className="btn-primary" onClick={() => { setIsWallGame(true); setStep('confirm'); }}>
                  Yes — wall game
                </button>
                <button className="btn-secondary" onClick={() => { setIsWallGame(false); setStep('winner'); }}>
                  No — someone won
                </button>
              </div>
            </WizardStep>
          )}

          {step === 'winner' && (
            <WizardStep title="Who won?" onBack={() => setStep('wall')}>
              <div className="btn-group vertical">
                {realPlayers.map((p) => (
                  <button
                    key={p.index}
                    className={`btn-choice ${winnerId === String(p.index) ? 'selected' : ''}`}
                    onClick={() => setWinnerId(String(p.index))}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <button className="btn-primary mt" disabled={winnerId === null} onClick={() => setStep('hand')}>
                Next
              </button>
            </WizardStep>
          )}

          {step === 'hand' && (
            <WizardStep title="What hand did they win with?" onBack={() => setStep('winner')}>
              <label>
                Hand name
                <input
                  value={handName}
                  onChange={(e) => setHandName(e.target.value)}
                  placeholder="e.g. 2468, Like Numbers…"
                />
              </label>
              <label>
                Base point value
                <input
                  type="number"
                  min="0"
                  value={basePoints}
                  onChange={(e) => setBasePoints(e.target.value)}
                  placeholder="e.g. 25"
                />
              </label>
              <button
                className="btn-primary mt"
                disabled={!basePoints || Number(basePoints) <= 0}
                onClick={() => setStep('jokers')}
              >
                Next
              </button>
            </WizardStep>
          )}

          {step === 'jokers' && (
            <WizardStep title="Were jokers used in the winning hand?" onBack={() => setStep('hand')}>
              <div className="btn-group">
                <button className="btn-secondary" onClick={() => { setNoJokers(false); setStep('draw'); }}>
                  Yes — jokers used
                </button>
                <button className="btn-primary" onClick={() => { setNoJokers(true); setStep('draw'); }}>
                  No jokers (+10 bonus)
                </button>
              </div>
            </WizardStep>
          )}

          {step === 'draw' && (
            <WizardStep title="Was the winning tile self-drawn?" onBack={() => setStep('jokers')}>
              <div className="btn-group">
                <button className="btn-primary" onClick={() => { setSelfDraw(true); setDiscarderId(null); setExposures(null); setIsQuints(null); setStep('confirm'); }}>
                  Yes — self-drawn (+10 bonus)
                </button>
                <button className="btn-secondary" onClick={() => { setSelfDraw(false); setStep('exposures'); }}>
                  No — from a discard
                </button>
              </div>
            </WizardStep>
          )}

          {step === 'exposures' && (
            <WizardStep title="How many exposures did the winner have?" onBack={() => setStep('draw')}>
              <p className="step-hint">An exposure is a set of tiles shown face-up on the table.</p>
              <div className="btn-group">
                {[0, 1, 2, 3].map((n) => (
                  <button
                    key={n}
                    className={`btn-choice ${exposures === String(n) ? 'selected' : ''}`}
                    onClick={() => setExposures(String(n))}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <button
                className="btn-primary mt"
                disabled={exposures === null}
                onClick={() => {
                  if (Number(exposures) === 2) setStep('quints');
                  else setStep('discarder');
                }}
              >
                Next
              </button>
            </WizardStep>
          )}

          {step === 'quints' && (
            <WizardStep title="Was this a Quints hand?" onBack={() => setStep('exposures')}>
              <p className="step-hint">A Quints hand with 2 exposures has a higher penalty (−25 instead of −20).</p>
              <div className="btn-group">
                <button className="btn-secondary" onClick={() => { setIsQuints(true); setStep('discarder'); }}>
                  Yes — Quints hand (−25)
                </button>
                <button className="btn-primary" onClick={() => { setIsQuints(false); setStep('discarder'); }}>
                  No (−20)
                </button>
              </div>
            </WizardStep>
          )}

          {step === 'discarder' && (
            <WizardStep title="Who discarded the winning tile?" onBack={() => setStep(Number(exposures) === 2 ? 'quints' : 'exposures')}>
              <div className="btn-group vertical">
                {realPlayers.filter((p) => p.index !== Number(winnerId)).map((p) => (
                  <button
                    key={p.index}
                    className={`btn-choice ${discarderId === String(p.index) ? 'selected' : ''}`}
                    onClick={() => setDiscarderId(String(p.index))}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <button className="btn-primary mt" disabled={discarderId === null} onClick={() => setStep('confirm')}>
                Next
              </button>
            </WizardStep>
          )}

          {step === 'confirm' && (
            <WizardStep title="Confirm scores">
              {scoringMode === 'manual' ? (
                <p className="confirm-note">
                  <strong>{players[manualWinnerId()]?.name}</strong> wins with{' '}
                  <em>{manualHandName || 'unnamed hand'}</em>
                </p>
              ) : (
                isWallGame
                  ? <p className="confirm-note">Wall game — everyone gets 10 points.</p>
                  : <p className="confirm-note">
                      <strong>{players[Number(winnerId)]?.name}</strong> won with{' '}
                      <em>{handName || 'unnamed hand'}</em>
                    </p>
              )}
              <div className="score-preview">
                {realPlayers.map((p) => {
                  const score = finalScores()[p.index];
                  return (
                    <div key={p.index} className="score-row">
                      <span className="score-player">{p.name}</span>
                      <span className={`score-value ${score > 0 ? 'positive' : score < 0 ? 'negative' : ''}`}>
                        {score}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="btn-group mt">
                <button className="btn-secondary" onClick={() => setStep('mode')}>Start over</button>
                <button className="btn-primary" onClick={handleFinish} disabled={saving}>
                  {saving ? 'Saving…' : 'Confirm & save'}
                </button>
              </div>
            </WizardStep>
          )}

        </div>
      </main>
    </div>
  );
}

function WizardStep({ title, children, onBack }) {
  return (
    <div className="wizard-step">
      {onBack && (
        <button className="back-link wizard-back" onClick={onBack}>← Back</button>
      )}
      <h2 className="step-title">{title}</h2>
      {children}
    </div>
  );
}
