import { Component, Input, OnDestroy } from '@angular/core';
import { PlayerAction, Notification, NotificationFlags, EntityPlayerState, Entity, Pony, FakeEntity } from '../../../common/interfaces';
import { PonyTownGame } from '../../../client/game';
import { hasFlag, setFlag } from '../../../common/utils';
import { faBan, faMapMarkerAlt } from '../../../client/icons';
import { getPaletteInfo } from '../../../common/pony';
import { PONY_TYPE } from '../../../common/constants';

@Component({
	selector: 'notification-item',
	templateUrl: 'notification-item.pug',
	styleUrls: ['notification-item.scss'],
})
export class NotificationItem implements OnDestroy {
	readonly banIcon = faBan;
	readonly markerIcon = faMapMarkerAlt;
	@Input() notification!: Notification;
	constructor(private game: PonyTownGame) {
	}
	get isOpen() {
		return this.notification.open;
	}
	set isOpen(value: boolean) {
		if (value) {
			this.game.notifications.forEach(n => n.open = false);
		}

		this.notification.open = value;
	}
	get okButton() {
		return hasFlag(this.notification.flags, NotificationFlags.Ok);
	}
	get yesButton() {
		return hasFlag(this.notification.flags, NotificationFlags.Yes);
	}
	get acceptButton() {
		return hasFlag(this.notification.flags, NotificationFlags.Accept);
	}
	get noButton() {
		return hasFlag(this.notification.flags, NotificationFlags.No);
	}
	get rejectButton() {
		return hasFlag(this.notification.flags, NotificationFlags.Reject);
	}
	get ignoreButton() {
		return hasFlag(this.notification.flags, NotificationFlags.Ignore);
	}
	get paletteInfo() {
		return getPaletteInfo(this.notification.pony);
	}
	ngOnDestroy() {
		this.isOpen = false;
	}
	accept() {
		this.game.send(server => server.acceptNotification(this.notification.id));
	}
	reject() {
		this.game.send(server => server.rejectNotification(this.notification.id));
	}
	who() {
		let pony: Entity = this.notification.pony;
		if (!pony.id) pony = { fake: true, type: PONY_TYPE, id: this.notification.entityId!, name: '' } as FakeEntity as any;
		this.game.select(pony as Pony);
	}
	ignore() {
		this.reject();

		const pony = this.notification.pony;

		if (pony !== this.game.player) {
			this.game.send(server => server.playerAction(pony.id, PlayerAction.Ignore, undefined));
			pony.playerState = setFlag(pony.playerState, EntityPlayerState.Ignored, true);
		}
	}
}
