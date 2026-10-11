import streamDeck from "@elgato/streamdeck";

import { BalanceProgress } from "./actions/balance";
import { CommendationProgress } from "./actions/commendation";
import { CookingTimer } from "./actions/cooking-timer";
import { SeasonProgressAction } from "./actions/season";
import { FactionLevelProgress } from "./actions/faction-level";
import { GameTimer } from "./actions/game-timer";
import { SessionCounter } from "./actions/session-counter";
import { StormTracker } from "./actions/storm";
import { Stopwatch } from "./actions/stopwatch";
import { XboxAchievementProgress } from "./actions/xbox-achievement";
import { watchGameSessions } from "./game-session";

streamDeck.logger.setLevel("info");

streamDeck.actions.registerAction(new CookingTimer());
streamDeck.actions.registerAction(new GameTimer());
streamDeck.actions.registerAction(new Stopwatch());
streamDeck.actions.registerAction(new SessionCounter());
streamDeck.actions.registerAction(new CommendationProgress());
streamDeck.actions.registerAction(new FactionLevelProgress());
streamDeck.actions.registerAction(new BalanceProgress());
streamDeck.actions.registerAction(new SeasonProgressAction());
streamDeck.actions.registerAction(new StormTracker());
streamDeck.actions.registerAction(new XboxAchievementProgress());

watchGameSessions();

streamDeck.connect();
