/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2025 ANUS Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';

export const WITTY_LOADING_PHRASES = [
  'Getting to the bottom of this...',
  'Processing from the rear...',
  'Working our way through the backend...',
  'Pushing through the pipeline...',
  'Squeezing out some results...',
  'Getting behind your request...',
  'Diving deep into the core...',
  'Probing the system depths...',
  'Entering through the back door...',
  'Flushing the cache...',
  'Clearing the pipes...',
  'Working from behind the scenes...',
  'Pushing data through the tunnel...',
  'Processing your rear-quest... I mean request...',
  'Getting cheeky with the algorithms...',
  'Bottoms up! Processing...',
  'Analyzing from all angles...',
  'Taking the scenic route through the backend...',
  'Clenching those computational muscles...',
  'Squeezing maximum performance...',
  'Working our assets off...',
  'Getting to the core of the matter...',
  'Pushing through tight constraints...',
  'Navigating narrow channels...',
  'Processing deep in the stack...',
  'Working the lower layers...',
  'Diving into the depths of computation...',
  'Exploring the dark corners of the codebase...',
  "Venturing where the sun don't shine (in the server room)...",
  'Getting our hands dirty in the backend...',
  'Plumbing the depths of logic...',
  'Unclogging the data flow...',
  'Releasing the pressure valve...',
  'Opening up new channels...',
  'Expanding our capacity...',
  'Stretching our computational limits...',
  'Flexing those processing muscles...',
  'Tightening up the algorithms...',
  'Loosening up the bottlenecks...',
  'Working out the kinks...',
  'Smoothing out the rough edges...',
  'Polishing the backend...',
  'Buffing up the performance...',
  'Getting down and dirty with the data...',
  'Rolling up our sleeves for deep work...',
  'Penetrating the problem space...',
  'Breaking through barriers...',
  'Pushing past resistance...',
  'Sliding into your DMs... I mean, database management...',
  'Backing up your data... way up...',
  'Getting intimate with the infrastructure...',
  'Exploring hidden passages in the code...',
  'Finding the secret tunnel to success...',
  'Taking the express route through the backend...',
  'Bypassing the usual channels...',
  'Finding alternative entry points...',
  'Accessing restricted areas...',
  'Breaching the inner sanctum...',
  'Infiltrating the core systems...',
  'Penetrating security layers (legally)...',
  'Getting past the gatekeepers...',
  'Slipping through the cracks...',
  'Finding the backdoor solution...',
  'Exploiting system openings (ethically)...',
  'Discovering hidden features...',
  'Unlocking secret functionality...',
  'Revealing concealed capabilities...',
  'Exposing hidden depths...',
  'Uncovering buried treasure...',
  'Digging deep for answers...',
  'Excavating solutions...',
  'Mining the data veins...',
  'Drilling down to the core...',
  'Boring through the layers...',
  'Tunneling to success...',
  'Carving out a solution...',
  'Sculpting the perfect response...',
  'Molding data to fit...',
  'Shaping up nicely...',
  'Forming a coherent response...',
  'Coming together nicely...',
  'Converging on a solution...',
  'Closing in on the answer...',
  'Zeroing in on the target...',
  'Homing in on success...',
  'Approaching from behind...',
  'Sneaking up on the solution...',
  'Catching the problem off guard...',
  'Ambushing inefficiency...',
  'Surprising you with excellence...',
  'Delivering unexpected pleasure... I mean, results...',
  'Exceeding expectations from behind...',
  'Coming from an unexpected angle...',
  'Taking the scenic route...',
  'Enjoying the journey through the backend...',
  'Savoring the computational process...',
  'Relishing the challenge...',
  'Embracing the complexity...',
  'Getting comfortable with discomfort...',
  'Settling into the groove...',
  'Finding our rhythm...',
  'Hitting our stride...',
  'Getting into position...',
  'Assuming the position... for optimal processing...',
  'Preparing for insertion... of data...',
  'Ready for deep integration...',
  'Warming up the engines...',
  'Revving up for action...',
  'Building up pressure...',
  'Generating thrust...',
  'Achieving liftoff...',
  'Breaking through the atmosphere...',
  'Entering new territory...',
  'Exploring uncharted regions...',
  'Venturing into the unknown...',
  'Boldly going where no code has gone before...',
  'Making first contact... with the solution...',
  'Establishing a connection...',
  'Forming a tight bond...',
  'Creating intimate relationships... between data structures...',
  'Bringing systems together...',
  'Unifying disparate elements...',
  'Merging streams...',
  'Converging flows...',
  'Coming together as one...',
  'Achieving unity...',
  'Reaching completion...',
  'Approaching climax... of the computation...',
  'Building to a crescendo...',
  'Reaching peak performance...',
  'Hitting the sweet spot...',
  'Finding the G-spot... the Good spot in the code...',
  'Touching all the right places... in memory...',
  'Stimulating the processors...',
  'Exciting the electrons...',
  'Getting the bits all worked up...',
  'Making the hardware sweat...',
  'Working up a computational lather...',
  'Getting hot and heavy... with the CPU...',
];

export const PHRASE_CHANGE_INTERVAL_MS = 15000;

/**
 * Custom hook to manage cycling through loading phrases.
 * @param isActive Whether the phrase cycling should be active.
 * @param isWaiting Whether to show a specific waiting phrase.
 * @returns The current loading phrase.
 */
export const usePhraseCycler = (isActive: boolean, isWaiting: boolean) => {
  const [currentLoadingPhrase, setCurrentLoadingPhrase] = useState(
    WITTY_LOADING_PHRASES[0],
  );
  const phraseIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isWaiting) {
      setCurrentLoadingPhrase('Waiting for user confirmation...');
      if (phraseIntervalRef.current) {
        clearInterval(phraseIntervalRef.current);
        phraseIntervalRef.current = null;
      }
    } else if (isActive) {
      if (phraseIntervalRef.current) {
        clearInterval(phraseIntervalRef.current);
      }
      // Select an initial random phrase
      const initialRandomIndex = Math.floor(
        Math.random() * WITTY_LOADING_PHRASES.length,
      );
      setCurrentLoadingPhrase(WITTY_LOADING_PHRASES[initialRandomIndex]);

      phraseIntervalRef.current = setInterval(() => {
        // Select a new random phrase
        const randomIndex = Math.floor(
          Math.random() * WITTY_LOADING_PHRASES.length,
        );
        setCurrentLoadingPhrase(WITTY_LOADING_PHRASES[randomIndex]);
      }, PHRASE_CHANGE_INTERVAL_MS);
    } else {
      // Idle or other states, clear the phrase interval
      // and reset to the first phrase for next active state.
      if (phraseIntervalRef.current) {
        clearInterval(phraseIntervalRef.current);
        phraseIntervalRef.current = null;
      }
      setCurrentLoadingPhrase(WITTY_LOADING_PHRASES[0]);
    }

    return () => {
      if (phraseIntervalRef.current) {
        clearInterval(phraseIntervalRef.current);
        phraseIntervalRef.current = null;
      }
    };
  }, [isActive, isWaiting]);

  return currentLoadingPhrase;
};
