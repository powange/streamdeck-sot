import streamDeck from "@elgato/streamdeck";

import { CommendationProgress } from "./actions/commendation";
import { CookingTimer } from "./actions/cooking-timer";
import { GameTimer } from "./actions/game-timer";
import { SessionCounter } from "./actions/session-counter";
import { Stopwatch } from "./actions/stopwatch";
import { XboxAchievementProgress } from "./actions/xbox-achievement";

streamDeck.logger.setLevel("info");

streamDeck.actions.registerAction(new CookingTimer());
streamDeck.actions.registerAction(new GameTimer());
streamDeck.actions.registerAction(new Stopwatch());
streamDeck.actions.registerAction(new SessionCounter());
streamDeck.actions.registerAction(new CommendationProgress());
streamDeck.actions.registerAction(new XboxAchievementProgress());

streamDeck.connect();
