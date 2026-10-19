# Temporary startup timing probe

Optional operator tooling, separate from the Mobile Web release. Enable only while investigating an actual slow start, then remove it. It adds no client module and does not change the application loader or cache policy.

The early inline probe sends navigation and resource timings, byte counts, coarse resource categories, standalone/Worker flags and cache entry counts to the same authenticated host. It never sends resource URLs, query strings, user agents, application data or request bodies. `/api/bot` entries are labelled as generic Bot API requests; they are not claimed to be a specific endpoint.

The host keeps at most 20 reports in memory. Reading reports requires an authenticated owner on the local listener; remote owners may only submit same-origin reports. Reports expire after ten minutes and disappear on plugin unload. This tool does not send data to an external service.
