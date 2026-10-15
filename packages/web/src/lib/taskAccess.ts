import { useEndpointVisible } from "../api/modules";

/** Tasks belong to the calendar module */
export const TASKS_PATH = "/tasks";

/**
 * Every button that gives a task (a request for Claude, a next step) is drawn only while this is true:
 * the module that owns tasks is installed and not hidden. `run()` refuses the write anyway when it is not installed.
 */
export const useTasksOn = () => useEndpointVisible(TASKS_PATH);
