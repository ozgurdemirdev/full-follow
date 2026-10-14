// db:generate must see every module's tables. A generated migration made while a module is switched off
// would drop that module's tables (plan-moduler.md rule 7), so refuse.
if (process.env.FF_MODULES_OFF?.trim()) {
  console.error(`db:generate refused: FF_MODULES_OFF="${process.env.FF_MODULES_OFF}" is set.`);
  console.error("A migration generated with modules switched off would drop their tables. Unset FF_MODULES_OFF and run it again.");
  process.exit(1);
}
