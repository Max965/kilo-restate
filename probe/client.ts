import { connect } from "@restatedev/restate-sdk-clients";

const rs = connect({ url: process.env.RESTATE_INGRESS ?? "http://localhost:8080" });
export const call = (service: string, handler: string, key: string, parameter: unknown) =>
  rs.call({ service, handler, key, parameter }) as Promise<any>;
export const send = (service: string, handler: string, key: string, parameter: unknown) =>
  rs.objectSendClient({ name: service }, key)[handler](parameter);
export const resolveAwakeable = (id: string, value: unknown) => rs.resolveAwakeable(id, value);
export const rejectAwakeable = (id: string, reason: string) => rs.rejectAwakeable(id, reason);
