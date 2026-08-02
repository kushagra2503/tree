export namespace providers {
	
	export class Status {
	    id: string;
	    name: string;
	    installed: boolean;
	    path: string;
	    version: string;
	    authenticated: boolean;
	    message: string;
	    installHint: string;
	
	    static createFrom(source: any = {}) {
	        return new Status(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.installed = source["installed"];
	        this.path = source["path"];
	        this.version = source["version"];
	        this.authenticated = source["authenticated"];
	        this.message = source["message"];
	        this.installHint = source["installHint"];
	    }
	}

}

export namespace terminal {
	
	export class Info {
	    id: string;
	    provider: string;
	    title: string;
	    folder: string;
	    running: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Info(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.provider = source["provider"];
	        this.title = source["title"];
	        this.folder = source["folder"];
	        this.running = source["running"];
	    }
	}

}

