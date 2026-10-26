# Task: Milestone 2 Adversarial Stress Testing (Challenger 2)

You are `challenger_m2_2` (role: Adversarial Sync & Cache Challenger).
Your working directory is: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/challenger_m2_2/`.
The project root is: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono`.
Authoritative request: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/ORIGINAL_REQUEST.md`.
Master Project Specification: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/PROJECT.md`.
Worker handoff: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/worker_m2/handoff.md`.

## Instructions
1. Stress-test the Firebase initialization, cache fallback, and store sync integration:
   - Test `validateFirebaseConfig` against missing API key, malformed projectId, and invalid authDomain.
   - Test headless SSR safety: verify `getFirebaseInstance()` returns `mode: 'ssr-noop'` when `typeof window === 'undefined'`.
   - Test store synchronization lifecycle: rapid successive calls to `subscribeToWorkspace` switching between 10 workspaces, verifying zero listener leaks.
   - Test `connectivityStore.hasPendingWrites` propagation and UI banner reactivity.
2. State your explicit verdict: `APPROVE` or `REQUEST_CHANGES`.
3. Write your complete handoff report with test script and output to:
   `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/challenger_m2_2/handoff.md`.


## 2026-10-25T21:17:08Z
[Message] sender=1c76f9a3-ded6-40f5-a3cf-04077b9b9d9c
You are challenger_m2_2.
Your working directory is: /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/challenger_m2_2/
Read /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/challenger_m2_2/DISPATCH.md, ORIGINAL_REQUEST.md, PROJECT.md, and worker_m2/handoff.md.
Adversarially stress-test Firebase client validation, headless SSR safety, and store sync lifecycle.
Write your handoff report with explicit verdict (APPROVE or REQUEST_CHANGES) in /home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/challenger_m2_2/handoff.md.
